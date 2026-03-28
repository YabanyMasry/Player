import * as dotenv from 'dotenv'
dotenv.config()

import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import fs from 'node:fs/promises'
import path from 'node:path'
import stringSimilarity from 'string-similarity' 
import spotifyRouter, { initSpotify, getSpotifyPlaylistTracks } from './spotify.js'

const app = express()
const PORT = Number(process.env.PORT || 4174)

// --- SECURITY MIDDLEWARE ---
app.use(helmet({
  crossOriginResourcePolicy: false, // Required so audio elements can load sources
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://sdk.scdn.co"],
      connectSrc: ["'self'", "https://api.spotify.com", "wss:", "ws:"],
      frameSrc: ["'self'", "https://sdk.scdn.co", "https://accounts.spotify.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "*"],
      mediaSrc: ["'self'", "data:", "blob:", "https:", "*"],
    },
  },
}))
app.use(cors())
app.use(express.json())

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', apiLimiter)

// --- LOCAL MUSIC PATH CONFIGURATION ---
const ALBUMS_ROOT = process.env.ALBUMS_ROOT || (process.env.VITE_PLAYER_MODE === 'spotify' ? process.cwd() : '');
const PLAYLISTS_ROOT = process.env.PLAYLISTS_ROOT || (ALBUMS_ROOT ? path.join(ALBUMS_ROOT, '..', 'Playlists') : process.cwd());

if (!ALBUMS_ROOT && process.env.VITE_PLAYER_MODE !== 'spotify') {
  console.error('\x1b[31m%s\x1b[0m', '❌ CRITICAL ERROR: ALBUMS_ROOT is not defined in .env! Cannot start the server in local mode.');
  process.exit(1);
}

const AUDIO_EXT_RE = /\.(mp3|m4a|aac|wav|flac|ogg|opus|wma)$/i
const COVER_RE = /^cover\.(jpg|jpeg|png|webp)$/i
const PLAYLIST_EXT_RE = /\.(m3u|m3u8)$/i
const LRC_EXT_RE = /\.lrc$/i

let cachedLibrary = {
  rootPath: ALBUMS_ROOT,
  scannedAt: null,
  tracks: [],
}

// --- UTILS ---
function toPosix(filePath) { return filePath.split(path.sep).join('/') }
function stripExtension(filename) { return String(filename || '').replace(/\.[^/.]+$/, '') }

function parseAlbumFolderName(folderName) {
  const fallback = { albumTitle: folderName || 'Unknown Album', albumArtist: 'Unknown Artist' }
  if (!folderName || !folderName.includes(' - ')) return fallback
  const parts = folderName.split(' - ').map(p => p.trim()).filter(Boolean)
  if (parts.length < 2) return fallback
  return { albumTitle: parts.slice(0, -1).join(' - '), albumArtist: parts[parts.length - 1] }
}

function parseTrackFileName(filename) {
  const base = stripExtension(filename)
  const match = base.match(/^(\d+)\s*-\s*(.+?)\s*-\s*(.+)$/)
  if (match) return { trackNumber: Number.parseInt(match[1], 10), artist: match[2].trim(), title: match[3].trim() }
  return { trackNumber: Number.MAX_SAFE_INTEGER, artist: 'Unknown Artist', title: base }
}

function parseLrcText(text) {
  const rows = []
  const lines = String(text || '').split(/\r?\n/)
  for (const line of lines) {
    const timestamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
    if (!timestamps.length) continue
    const lyricText = line.replace(/\[[^\]]+\]/g, '').trim()
    for (const stamp of timestamps) {
      const min = Number.parseInt(stamp[1], 10)
      const sec = Number.parseInt(stamp[2], 10)
      const fractionRaw = stamp[3] ?? '0'
      const fraction = Number.parseInt(fractionRaw.padEnd(3, '0').slice(0, 3), 10)
      const time = min * 60 + sec + fraction / 1000
      rows.push({ time, text: lyricText || '...' })
    }
  }
  rows.sort((a, b) => a.time - b.time)
  return rows
}

function parseM3uOrder(content) {
  const orderMap = new Map()
  const lines = String(content || '').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim().replace(/^['"]|['"]$/g, '')
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/[\\/]/)
    const base = (parts[parts.length - 1] || '').toLowerCase()
    if (!base) continue
    if (!orderMap.has(base)) orderMap.set(base, orderMap.size)
  }
  return orderMap
}

function safeResolveMediaPath(relativePath) {
  const decoded = decodeURIComponent(relativePath || '')
  const abs = path.resolve(ALBUMS_ROOT, decoded)
  const root = path.resolve(ALBUMS_ROOT)
  if (!abs.startsWith(root)) throw new Error('Invalid path')
  return abs
}

// --- SCANNING ENGINE ---
async function scanLibrary() {
  const rootEntries = await fs.readdir(ALBUMS_ROOT, { withFileTypes: true })
  const albumDirs = rootEntries.filter(e => e.isDirectory())
  const tracks = []

  for (const dir of albumDirs) {
    const albumFolderName = dir.name
    const albumAbsPath = path.join(ALBUMS_ROOT, albumFolderName)

    let jsonMeta = null
    try {
      const jsonText = await fs.readFile(path.join(albumAbsPath, `${albumFolderName}.json`), 'utf8')
      jsonMeta = JSON.parse(jsonText)
    } catch { }

    const fallbackMeta = parseAlbumFolderName(albumFolderName)
    const albumTitle = jsonMeta?.playlist?.title || fallbackMeta.albumTitle
    const albumArtist = jsonMeta?.playlist?.artist?.name || fallbackMeta.albumArtist

    const allFiles = []
    async function walk(currentDir) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) await walk(fullPath)
        else allFiles.push({ name: entry.name, fullPath, dirName: path.basename(currentDir) })
      }
    }
    await walk(albumAbsPath)

    let coverRelativePath = null
    let playlistOrderMap = new Map()
    const lyricsByBase = new Map()

    for (const file of allFiles) {
      const lower = file.name.toLowerCase()
      const rel = toPosix(path.relative(ALBUMS_ROOT, file.fullPath))
      if (COVER_RE.test(file.name)) { if (!coverRelativePath) coverRelativePath = rel; continue; }
      if (PLAYLIST_EXT_RE.test(lower)) {
        try {
          const m3uText = await fs.readFile(file.fullPath, 'utf8')
          const parsed = parseM3uOrder(m3uText)
          if (parsed.size > 0) playlistOrderMap = parsed
        } catch { }
        continue
      }
      if (LRC_EXT_RE.test(lower)) {
        try {
          const lrcText = await fs.readFile(file.fullPath, 'utf8')
          lyricsByBase.set(stripExtension(file.name).toLowerCase(), parseLrcText(lrcText))
        } catch { }
      }
    }

    const audioFiles = allFiles.filter(f => AUDIO_EXT_RE.test(f.name))
    const parsedAlbumTracks = audioFiles.map((file) => {
      const fileName = file.name
      const relativePath = toPosix(path.relative(ALBUMS_ROOT, file.fullPath))
      const basenm = stripExtension(fileName)
      let discNumber = 1
      const discMatch = file.dirName.match(/Disc\s*(\d+)/i)
      if (discMatch) discNumber = Number.parseInt(discMatch[1], 10)
      let jsonTrack = null
      if (jsonMeta && Array.isArray(jsonMeta.tracks)) {
        const match = basenm.match(/^(\d+)/)
        if (match) {
          const pos = Number.parseInt(match[1], 10)
          jsonTrack = jsonMeta.tracks.find(t => t.position === pos || t.trackNumber === pos)
        }
      }
      const trackMeta = parseTrackFileName(fileName)
      const playlistOrder = playlistOrderMap.get(fileName.toLowerCase())
      const finalArtist = jsonTrack?.artist || trackMeta.artist || albumArtist
      const finalTitle = jsonTrack?.title || trackMeta.title

      return {
        id: relativePath, album: albumTitle, albumArtist, artist: finalArtist, title: finalTitle,
        filename: fileName, relativePath, absolutePath: file.fullPath, discNumber,
        trackNumber: jsonTrack?.trackNumber ?? (Number.isFinite(trackMeta.trackNumber) ? trackMeta.trackNumber : Number.MAX_SAFE_INTEGER),
        coverUrl: coverRelativePath ? `/media/${coverRelativePath.split('/').map(encodeURIComponent).join('/')}` : null,
        lyrics: lyricsByBase.get(basenm.toLowerCase()) || [],
        orderKey: Number.isFinite(playlistOrder) ? playlistOrder : (jsonTrack?.position ?? (Number.isFinite(trackMeta.trackNumber) ? trackMeta.trackNumber : Number.MAX_SAFE_INTEGER)),
        duration: jsonTrack?.duration || undefined,
      }
    })

    for (const t of parsedAlbumTracks) {
      tracks.push({ ...t, url: `/media/${t.relativePath.split('/').map(encodeURIComponent).join('/')}` })
    }
  }
  cachedLibrary = { rootPath: ALBUMS_ROOT, scannedAt: new Date().toISOString(), tracks }
}

// --- SYNC ENGINE ---
function matchTracksToLocalLibrary(spotifyTracks, localTracks) {
  console.log(`[Sync] Starting fuzzy match for ${spotifyTracks.length} tracks...`);
  const localTrackStrings = localTracks.map(t => `${t.artist} ${t.title}`.toLowerCase());
  const matchedPaths = [];
  const notFound = [];

  for (const sTrack of spotifyTracks) {
    const searchString = `${sTrack.artist} ${sTrack.title}`.toLowerCase();
    if (localTrackStrings.length === 0) { notFound.push(sTrack); continue; }
    const match = stringSimilarity.findBestMatch(searchString, localTrackStrings);
    if (match.bestMatch.rating > 0.65) {
      matchedPaths.push(localTracks[match.bestMatchIndex].absolutePath);
    } else {
      notFound.push(sTrack);
    }
  }
  return { matchedPaths, notFound };
}

// --- ROUTES ---
app.use('/api/auth', spotifyRouter);

app.post('/api/playlists/import-spotify', async (req, res) => {
  try {
    const { spotifyUrl } = req.body;
    let playlistId = null;
    if (spotifyUrl.includes('playlist/')) playlistId = spotifyUrl.split('playlist/')[1].split('?')[0].split('/')[0];
    else if (spotifyUrl.startsWith('spotify:playlist:')) playlistId = spotifyUrl.split(':')[2];

    if (!playlistId) return res.status(400).json({ error: 'Invalid Spotify Playlist URL format.' });
    if (!cachedLibrary.scannedAt) await scanLibrary();

    const { playlistName, tracks: spotifyTracks } = await getSpotifyPlaylistTracks(playlistId);
    const { matchedPaths, notFound } = matchTracksToLocalLibrary(spotifyTracks, cachedLibrary.tracks);

    const m3u8Content = "#EXTM3U\n" + matchedPaths.map(p => toPosix(p)).join('\n');
    const safeFileName = playlistName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
    const playlistFilePath = path.join(PLAYLISTS_ROOT, `${safeFileName}.m3u8`);

    await fs.mkdir(PLAYLISTS_ROOT, { recursive: true });
    await fs.writeFile(playlistFilePath, m3u8Content, 'utf8');

    res.json({ success: true, playlistName: safeFileName, matchedCount: matchedPaths.length, totalCount: spotifyTracks.length, missingTracks: notFound });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/playlists', async (req, res) => {
  try {
    const entries = await fs.readdir(PLAYLISTS_ROOT, { withFileTypes: true });
    const playlists = entries
      .filter(e => e.isFile() && PLAYLIST_EXT_RE.test(e.name))
      .map(e => ({ name: stripExtension(e.name), filename: e.name }));
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/playlists/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const absPath = path.join(PLAYLISTS_ROOT, filename);
    const content = await fs.readFile(absPath, 'utf8');
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));

    if (!cachedLibrary.scannedAt) await scanLibrary();

    const playlistTracks = lines.map(line => {
      // The line is the toPosix(t.absolutePath)
      return cachedLibrary.tracks.find(t => toPosix(t.absolutePath) === line);
    }).filter(Boolean);

    res.json({ name: stripExtension(filename), tracks: playlistTracks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/library', async (_req, res) => {
  if (!cachedLibrary.scannedAt) await scanLibrary()
  res.json(cachedLibrary)
})

app.post('/api/library/refresh', async (_req, res) => {
  await scanLibrary()
  res.json(cachedLibrary)
})

app.get('/media/*', async (req, res) => {
  try {
    const filePath = safeResolveMediaPath(req.params[0])
    res.sendFile(filePath)
  } catch {
    res.status(404).json({ error: 'Media file not found' })
  }
})

// --- STATIC FRONTEND SERVING (PRODUCTION ONLY) ---
import fsSync from 'node:fs';
const distPath = path.join(process.cwd(), 'dist');

if (process.env.NODE_ENV === 'production' || fsSync.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    // Prevent the wildcard from breaking API or media routes if they weren't caught
    if (req.path.startsWith('/api') || req.path.startsWith('/media')) return res.status(404).json({ error: 'Endpoint not found' });
    
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, async () => {
  console.log(`[library-server] http://localhost:${PORT}`)
  if (process.env.NODE_ENV === 'production') {
    console.log(`[production] Serving frontend directly from /dist`);
  }
  await initSpotify(ALBUMS_ROOT, PLAYLISTS_ROOT, PORT);
})