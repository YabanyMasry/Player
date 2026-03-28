import React, { useState, useEffect } from 'react';
import { usePlayer } from '../state/PlayerContext';
import './PlaylistsPage.css';

export default function PlaylistsPage() {
  const { loadPlaylist, mode } = usePlayer();
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Spotify Import State
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [importStatus, setImportStatus] = useState({ loading: false, message: 'AWAITING SYNC...', type: 'idle' });
  const [authStatus, setAuthStatus] = useState({ authenticated: false, loading: true });

  useEffect(() => {
    fetchPlaylists();

    // Check Spotify Auth Status
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => setAuthStatus({ authenticated: data.authenticated, loading: false }))
      .catch(() => setAuthStatus({ authenticated: false, loading: false }));
  }, []);

  const fetchPlaylists = async () => {
    setIsLoading(true);
    try {
      if (mode === 'spotify') {
        const response = await fetch('/api/auth/spotify/playlists?limit=50');
        if (!response.ok) throw new Error('Failed to fetch Spotify playlists');
        const data = await response.json();
        const items = (data.items || []).map(p => ({
          name: p.name,
          filename: p.id,
          spotifyUri: p.uri,
          imageUrl: p.images?.[0]?.url || null,
          trackCount: p.tracks?.total || 0,
        }));
        setPlaylists(items);
      } else {
        const response = await fetch('/api/playlists');
        if (!response.ok) throw new Error('Failed to fetch playlists');
        const data = await response.json();
        setPlaylists(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlaylist = async (playlist) => {
    setIsLoading(true);
    try {
      if (mode === 'spotify' && playlist.spotifyUri) {
        const id = playlist.spotifyUri.split(':').pop();
        const response = await fetch(`/api/auth/spotify/playlists/${id}/tracks?limit=100`);
        if (!response.ok) throw new Error('Failed to load Spotify playlist tracks');
        const data = await response.json();
        const tracks = (data.items || [])
          .filter(item => item?.track)
          .map(item => ({
            id: item.track.id,
            title: item.track.name,
            artist: item.track.artists?.map(a => a.name).join(', ') || 'Unknown',
            album: item.track.album?.name || 'Unknown Album',
            coverUrl: item.track.album?.images?.[0]?.url || null,
            spotifyUri: item.track.uri,
            filename: item.track.name,
          }));
        setSelectedPlaylist({ name: playlist.name, tracks, spotifyUri: playlist.spotifyUri });
      } else {
        const response = await fetch(`/api/playlists/${encodeURIComponent(playlist.filename)}`);
        if (!response.ok) throw new Error('Failed to load playlist tracks');
        const data = await response.json();
        setSelectedPlaylist(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPlaylist = () => {
    if (selectedPlaylist && selectedPlaylist.tracks.length > 0) {
      loadPlaylist(selectedPlaylist);
    }
  };

  const handleImportSpotify = async () => {
    if (!spotifyUrl.trim()) return;
    
    setImportStatus({ loading: true, message: 'SYNCING API...', type: 'loading' });
    
    try {
      const response = await fetch('/api/playlists/import-spotify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyUrl: spotifyUrl.trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }
      
      setImportStatus({ 
        loading: false, 
        message: `OK: ${data.matchedCount}/${data.totalCount} -> ${data.playlistName}`, 
        type: 'success' 
      });
      setSpotifyUrl('');
      
      // Refresh the playlists list
      fetchPlaylists();
      
    } catch (error) {
      setImportStatus({ 
        loading: false, 
        message: `ERR: ${error.message.toUpperCase()}`, 
        type: 'error' 
      });
    }
  };

  const statusColors = {
    idle: '#888',
    loading: '#facc15', // Amber
    success: '#4ade80', // Green
    error: '#f87171'    // Red
  };

  return (
    <main className="panel playlists-page">
      <div className="playlists-container">
        {/* Left Rack: Playlist Selection */}
        <section className="playlist-rack">
          <div className="rack-header">
            <h3>INPUT CHANNELS</h3>
            <div className="rack-led-strip">
              <span className="led green on"></span>
              <span className="led yellow"></span>
              <span className="led red"></span>
            </div>
          </div>

          <div className="rack-import-section" style={{ marginBottom: '24px', padding: '12px', background: 'linear-gradient(135deg, #181818, #0a0a0a)', border: '1px solid #000', borderRadius: '4px', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'monospace', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>SPOTIFY DATA SYNC</span>
              <a 
                href="http://127.0.0.1:4174/api/auth/login"
                style={{ color: authStatus.authenticated ? '#4ade80' : '#1db954', textDecoration: 'none' }}
              >
                {authStatus.loading ? '...' : authStatus.authenticated ? '[CONNECTED]' : '[LOGIN REQ]'}
              </a>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input 
                type="text" 
                placeholder="https://open.spotify.com/playlist/..." 
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                disabled={importStatus.loading}
                style={{
                  flex: 1,
                  background: '#050505',
                  border: '1px solid #222',
                  borderRadius: '2px',
                  padding: '6px 8px',
                  color: '#38bdf8',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  outline: 'none',
                  minWidth: '0'
                }}
              />
              <button 
                onClick={handleImportSpotify}
                disabled={importStatus.loading || !spotifyUrl.trim()}
                style={{
                  background: 'linear-gradient(145deg, #222, #111)',
                  border: '1px solid #000',
                  color: importStatus.loading ? '#facc15' : (spotifyUrl.trim() ? '#fff' : '#555'),
                  padding: '0 12px',
                  borderRadius: '2px',
                  cursor: importStatus.loading || !spotifyUrl.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  transition: 'all 0.1s'
                }}
              >
                {importStatus.loading ? '...' : 'SYNC'}
              </button>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: statusColors[importStatus.type], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              &gt; {importStatus.message}
            </div>
          </div>
          
          <div className="rack-slots">
            {playlists.length === 0 ? (
              <p className="muted">No playlists found.</p>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.filename}
                  className={`rack-slot ${selectedPlaylist?.name === pl.name ? 'active' : ''}`}
                  onClick={() => handleSelectPlaylist(pl)}
                >
                  <div className="slot-indicator"></div>
                  <span className="slot-label">{pl.name}</span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Right Panel: Track List / Details */}
        <section className="playlist-details">
          {selectedPlaylist ? (
            <div className="details-content">
              <div className="details-header">
                <div className="playlist-info">
                  <h2>{selectedPlaylist.name}</h2>
                  <p className="muted">{selectedPlaylist.tracks.length} Tracks</p>
                </div>
                <button 
                  className="primary play-btn" 
                  onClick={handlePlayPlaylist}
                  disabled={selectedPlaylist.tracks.length === 0}
                >
                  LOAD INTO PLAYER
                </button>
              </div>

              <div className="track-list-container">
                <table className="playlist-tracks">
                  <thead>
                    <tr>
                      <th className="num-col">#</th>
                      <th>TITLE</th>
                      <th>ARTIST</th>
                      <th className="album-col">ALBUM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlaylist.tracks.map((track, idx) => (
                      <tr key={idx} className="track-row">
                        <td className="num-col muted">{idx + 1}</td>
                        <td className="track-title">{track.title}</td>
                        <td className="track-artist muted">{track.artist}</td>
                        <td className="album-col muted">{track.album}</td>
                      </tr>
                    ))}
                    {selectedPlaylist.tracks.length === 0 && (
                      <tr>
                        <td colSpan="4" className="muted text-center">Playlist is empty or tracks are missing locally.</td>
                      </tr>
                    ) }
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="placeholder-content">
              <div className="rack-logo">
                <span className="logo-icon">≣</span>
                <h3>VIRTUAL PLAYLIST MODULE</h3>
                <p className="muted">SELECT A CHANNEL TO BEGIN</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {isLoading && <div className="loading-overlay">PROCESSING...</div>}
      {error && <div className="error-banner">ERROR: {error}</div>}
    </main>
  );
}
