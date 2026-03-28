import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

import * as dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// --- CONFIGURATION ---
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.warn('\x1b[33m%s\x1b[0m', '⚠️ [WARNING] Spotify API credentials are missing from .env. Playlist importing will fail. ⚠️');
}

let ALBUMS_ROOT = '';
let PLAYLISTS_ROOT = '';
let PORT = process.env.PORT || 4174;
let TOKENS_PATH = '';

let spotifyAuth = {
  access_token: null,
  refresh_token: null,
  expires_at: 0
};

let refreshTimerId = null;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
const TOKEN_REFRESH_INTERVAL_MS = 45 * 60 * 1000; // Background refresh every 45 min

export async function initSpotify(albumsRoot, playlistsRoot, port) {
  ALBUMS_ROOT = albumsRoot;
  PLAYLISTS_ROOT = playlistsRoot;
  PORT = port;
  
  TOKENS_PATH = path.join(process.cwd(), 'spotify_tokens.json');
  await loadTokens();

  // Only run the startup refresh and background timer if we are in Spotify mode
  if (process.env.VITE_PLAYER_MODE === 'spotify') {
    // Immediately refresh if we have a refresh token (ensures fresh token on startup)
    if (spotifyAuth.refresh_token) {
      try {
        await getSpotifyToken(true);
        console.log('[Spotify] Token refreshed on startup.');
      } catch (err) {
        console.warn('[Spotify] Could not refresh token on startup:', err.message);
      }
    }

    // Start background auto-refresh loop
    startAutoRefresh();
  }
}

// --- TOKEN MANAGEMENT ---

async function loadTokens() {
  try {
    const data = await fs.readFile(TOKENS_PATH, 'utf8');
    spotifyAuth = JSON.parse(data);
    console.log('[Spotify] User tokens loaded from disk.');
  } catch {
    console.log('[Spotify] No tokens found on disk. User needs to login.');
  }
}

async function saveTokens() {
  await fs.writeFile(TOKENS_PATH, JSON.stringify(spotifyAuth, null, 2), 'utf8');
}

export async function getSpotifyToken(forceRefresh = false) {
  // Refresh proactively when within the buffer window (5 min before actual expiry)
  const isValid = spotifyAuth.access_token && (spotifyAuth.expires_at - TOKEN_REFRESH_BUFFER_MS) > Date.now();
  if (!forceRefresh && isValid) {
    return spotifyAuth.access_token;
  }

  if (spotifyAuth.refresh_token) {
    console.log('[Spotify Auth] Refreshing user access token...');
    try {
      const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: spotifyAuth.refresh_token
        })
      });

      if (response.ok) {
        const data = await response.json();
        spotifyAuth.access_token = data.access_token;
        if (data.refresh_token) spotifyAuth.refresh_token = data.refresh_token;
        spotifyAuth.expires_at = Date.now() + (data.expires_in * 1000);
        await saveTokens();
        return spotifyAuth.access_token;
      } else {
        const errText = await response.text();
        console.error('[Spotify Auth] Failed to refresh token:', errText);
      }
    } catch (err) {
      console.error('[Spotify Auth Error]:', err.message);
    }
  }

  // Fallback to client credentials (very limited)
  console.log('[Spotify Auth] Falling back to client credentials...');
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Spotify Auth Failed. Please visit http://127.0.0.1:${PORT}/api/auth/login`);
  }

  const data = await response.json();
  return data.access_token;
}

function startAutoRefresh() {
  if (refreshTimerId) clearInterval(refreshTimerId);
  refreshTimerId = setInterval(async () => {
    if (!spotifyAuth.refresh_token) return;
    try {
      await getSpotifyToken(true);
      console.log('[Spotify] Background token auto-refresh successful.');
    } catch (err) {
      console.warn('[Spotify] Background auto-refresh failed:', err.message);
    }
  }, TOKEN_REFRESH_INTERVAL_MS);
  console.log('[Spotify] Auto-refresh timer started (every 45 min).');
}

// --- PLAYLIST EXTRACTION ENGINE ---
// Uses Spotify's embed page to extract track data.
// This bypasses Spotify's restrictive Development Mode API limits
// which block /tracks and /items endpoints with 403 Forbidden.

async function fetchEmbedData(playlistId) {
  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
  console.log(`[Spotify Engine] Fetching embed page...`);

  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Spotify embed page: ${res.status}`);
  }

  const html = await res.text();
  const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);

  if (!scriptMatch) {
    throw new Error('Could not find track data in Spotify embed page. Spotify may have changed their page structure.');
  }

  const nextData = JSON.parse(scriptMatch[1]);
  const entity = nextData?.props?.pageProps?.state?.data?.entity;

  if (!entity) {
    throw new Error('Could not parse playlist entity from embed page data.');
  }

  return entity;
}

async function fetchTracksViaAPI(playlistId) {
  let token = await getSpotifyToken();
  let tracks = [];

  // Try the API first (works if user has Extended Quota or for some playlists)
  const playlistUrl = `https://api.spotify.com/v1/playlists/${playlistId}`;
  let res = await fetch(playlistUrl, { headers: { 'Authorization': `Bearer ${token}` } });

  if (res.status === 401 || res.status === 403) {
    token = await getSpotifyToken(true);
    res = await fetch(playlistUrl, { headers: { 'Authorization': `Bearer ${token}` } });
  }

  if (!res.ok) return null; // API didn't work, caller will fall back

  const data = await res.json();
  const playlistName = data.name || `Spotify_Import_${playlistId}`;

  // Check if the API actually gave us tracks
  if (data.tracks && data.tracks.items && data.tracks.items.length > 0) {
    console.log('[Spotify Engine] API returned tracks directly! Using API data.');
    tracks.push(...data.tracks.items.filter(i => i?.track).map(i => ({
      title: i.track.name,
      artist: i.track.artists ? i.track.artists.map(a => a.name).join(', ') : 'Unknown Artist'
    })));

    // Paginate
    let nextUrl = data.tracks.next;
    while (nextUrl) {
      let pageRes = await fetch(nextUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (pageRes.status === 401 || pageRes.status === 403) {
        token = await getSpotifyToken(true);
        pageRes = await fetch(nextUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      }
      if (!pageRes.ok) break;
      const pageData = await pageRes.json();
      if (pageData.items) {
        tracks.push(...pageData.items.filter(i => i?.track).map(i => ({
          title: i.track.name,
          artist: i.track.artists ? i.track.artists.map(a => a.name).join(', ') : 'Unknown Artist'
        })));
      }
      nextUrl = pageData.next;
    }

    return { playlistName, tracks };
  }

  // API gave us metadata but no tracks — return the name for the embed fallback
  return { playlistName, tracks: null };
}

export async function getSpotifyPlaylistTracks(playlistId) {
  console.log(`\n[Spotify Engine] Starting fetch for Playlist ID: ${playlistId}`);

  // Strategy 1: Try the official API first
  const apiResult = await fetchTracksViaAPI(playlistId);

  if (apiResult && apiResult.tracks && apiResult.tracks.length > 0) {
    console.log(`[Spotify Engine] API returned ${apiResult.tracks.length} tracks for "${apiResult.playlistName}".`);
    return apiResult;
  }

  // Strategy 2: Fall back to the embed page scraping
  console.log('[Spotify Engine] API returned no tracks. Falling back to embed page extraction...');

  try {
    const entity = await fetchEmbedData(playlistId);
    const playlistName = apiResult?.playlistName || entity.name || `Spotify_Import_${playlistId}`;

    if (!entity.trackList || entity.trackList.length === 0) {
      console.warn('[Spotify Engine] Embed page also returned no tracks!');
      return { playlistName, tracks: [] };
    }

    const tracks = entity.trackList
      .filter(t => t.title)
      .map(t => ({
        title: t.title,
        artist: t.subtitle || 'Unknown Artist'
      }));

    console.log(`[Spotify Engine] Successfully extracted ${tracks.length} tracks from embed page for "${playlistName}".`);
    return { playlistName, tracks };
  } catch (embedError) {
    console.error('[Spotify Engine] Embed extraction failed:', embedError.message);
    // Return empty rather than crash
    return { playlistName: apiResult?.playlistName || `Spotify_Import_${playlistId}`, tracks: [] };
  }
}

// --- AUTH ROUTES ---

const getRedirectUri = (req) => {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  // Local development override to avoid mismatch if local server uses IPv4 or localhost weirdly
  // but generally relying on req.get('host') is the best for serverless proxy deployments
  return `${protocol}://${host}/api/auth/callback`;
};

router.get('/login', (req, res) => {
  const scope = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-library-read',
  ].join(' ');
  const spotifyUrl = `https://accounts.spotify.com/authorize?` + new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: scope,
    redirect_uri: getRedirectUri(req),
  }).toString();
  res.redirect(spotifyUrl);
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`Auth Failed: ${error}`);
  if (!code) return res.status(400).send('No code provided');

  try {
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: getRedirectUri(req)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(400).send(`Token Exchange Failed: ${JSON.stringify(data)}`);
    }

    spotifyAuth = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };
    await saveTokens();
    // Redirect back to the app settings page dynamically
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    res.redirect(`${protocol}://${host}/settings`);
  } catch (error) {
    res.status(500).send(`Auth Error: ${error.message}`);
  }
});

router.get('/status', (req, res) => {
  res.json({
    authenticated: !!(spotifyAuth.access_token && spotifyAuth.expires_at > Date.now()),
    hasRefreshToken: !!spotifyAuth.refresh_token
  });
});

router.get('/token', async (req, res) => {
  try {
    const token = await getSpotifyToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ access_token: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logout', async (req, res) => {
  spotifyAuth = { access_token: null, refresh_token: null, expires_at: 0 };
  try {
    await fs.unlink(TOKENS_PATH);
  } catch { /* file may not exist */ }
  res.json({ success: true });
});

router.get('/me', async (req, res) => {
  try {
    const token = await getSpotifyToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated or missing token' });

    let response = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      const refreshedToken = await getSpotifyToken(true);
      if (!refreshedToken) return res.status(401).json({ error: 'Token refresh failed' });
      response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${refreshedToken}` }
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Spotify API error: ${errorText}` });
    }

    const userData = await response.json();
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SPOTIFY API PROXY ROUTES ---

async function spotifyProxy(req, res, spotifyPath) {
  try {
    let token = await getSpotifyToken();
    if (!token) {
      console.log(`[Spotify Proxy] Fail: Not authenticated, requested ${spotifyPath}`);
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log(`[Spotify Proxy] Requesting: https://api.spotify.com/v1${spotifyPath}`);
    let response = await fetch(`https://api.spotify.com/v1${spotifyPath}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      console.log(`[Spotify Proxy] Received ${response.status}, attempting token refresh...`);
      token = await getSpotifyToken(true);
      if (!token) return res.status(401).json({ error: 'Token refresh failed' });
      
      console.log(`[Spotify Proxy] Retrying with new token: https://api.spotify.com/v1${spotifyPath}`);
      response = await fetch(`https://api.spotify.com/v1${spotifyPath}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Spotify Proxy] ❌ API ERROR [${response.status}] for ${spotifyPath}:`, errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    console.log(`[Spotify Proxy] ✅ Success [${response.status}] for ${spotifyPath}`);
    res.json(data);
  } catch (err) {
    console.error(`[Spotify Proxy] 🚨 Fatal Exception:`, err);
    res.status(500).json({ error: err.message });
  }
}

router.get('/spotify/albums', (req, res) => {
  const limit = req.query.limit || 50;
  const offset = req.query.offset || 0;
  spotifyProxy(req, res, `/me/albums?limit=${limit}&offset=${offset}`);
});

router.get('/spotify/playlists', (req, res) => {
  const limit = req.query.limit || 50;
  const offset = req.query.offset || 0;
  spotifyProxy(req, res, `/me/playlists?limit=${limit}&offset=${offset}`);
});

router.get('/spotify/playlists/:id/items', async (req, res) => {
  const playlistId = req.params.id;
  const limit = req.query.limit || 100;
  const offset = req.query.offset || 0;
  
  try {
    // Strategy 1: Try the direct API
    let token = await getSpotifyToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const spotifyPath = `/playlists/${playlistId}/items?limit=${limit}&offset=${offset}&additional_types=track`;
    let response = await fetch(`https://api.spotify.com/v1${spotifyPath}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      if (response.status === 401) {
        token = await getSpotifyToken(true);
        response = await fetch(`https://api.spotify.com/v1${spotifyPath}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    }

    if (response.ok) {
      const data = await response.json();
      // Check if we actually got tracks
      if (data.items && data.items.length > 0 && data.items.some(i => i?.track)) {
        return res.json(data);
      }
    }

    // Strategy 2: Fall back to embed extraction
    console.log(`[Spotify Proxy] API failed or empty for playlist ${playlistId}, falling back to embed extraction...`);
    const result = await getSpotifyPlaylistTracks(playlistId);
    
    // Map to the same shape the frontend expects
    const items = (result.tracks || []).map(t => ({
      track: {
        id: null,
        name: t.title,
        uri: null,
        artists: [{ name: t.artist }],
        album: { name: 'Unknown Album', images: [], artists: [{ name: t.artist }] },
        track_number: null,
      }
    }));
    
    res.json({ items, total: items.length });
  } catch (err) {
    console.error('[Spotify Proxy] Playlist items error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/spotify/tracks', (req, res) => {
  const limit = req.query.limit || 50;
  const offset = req.query.offset || 0;
  spotifyProxy(req, res, `/me/tracks?limit=${limit}&offset=${offset}`);
});

export default router;