import React, { useState, useEffect } from 'react';
import { usePlayer } from '../state/PlayerContext';
import './SettingsPage.css'; // Don't forget to import the CSS!

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

// ----------------------------------------------------------------------------
// Reusable Fader Component
// ----------------------------------------------------------------------------
const RetroFader = ({ label, value, min, max, step, onChange, unit = "", highlightColor = "#38bdf8", description, displayValue }) => (
  <div style={{ marginBottom: '24px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
      <div>
        <span style={{ fontWeight: '600', color: '#ccc', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.85rem' }}>{label}</span>
        {description && <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '4px' }}>{description}</div>}
      </div>
      <span className="lcd-readout" style={{ color: highlightColor, fontWeight: 'bold', fontSize: '0.9rem' }}>
        {displayValue !== undefined ? displayValue : value}{unit}
      </span>
    </div>
    <input 
      type="range" 
      className="retro-fader" 
      min={min} 
      max={max} 
      step={step} 
      value={value} 
      onChange={onChange} 
    />
  </div>
);

export default function SettingsPage() {
  const [texturesEnabled, setTexturesEnabled] = useState(true);
  const [spotifyUser, setSpotifyUser] = useState(null);
  
  const { audioEffects, setAudioEffects, playbackRate, setPlaybackRate, handleResetDefaults, mode } = usePlayer();

  // Helpers for Displays
  const getStereoLabel = (val) => {
    if (val === 0) return "TRUE MONO";
    if (val === 0.5) return "NORM";
    if (val > 0.95) return "ULTRA WIDE";
    return `${Math.round(val * 200)}%`;
  };

  const getFilterLabel = (val) => {
    if (val === 0) return "BYPASS";
    if (val < 0) return `LO-PASS ${Math.round(Math.abs(val) * 100)}%`;
    return `HI-PASS ${Math.round(val * 100)}%`;
  };

  useEffect(() => {
    const cookieVal = getCookie('enableAlbumTextures');
    if (cookieVal === 'false') {
      setTexturesEnabled(false);
    }

    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not connected');
        return res.json();
      })
      .then(data => setSpotifyUser(data))
      .catch(err => console.log("Spotify profile fetch skipped/failed:", err.message));
  }, []);

  const handleToggle = (e) => {
    const checked = e.target.checked;
    setTexturesEnabled(checked);
    setCookie('enableAlbumTextures', checked ? 'true' : 'false');
    window.location.reload();
  };

  const handleEffectChange = (key, value) => {
    setAudioEffects(prev => ({ ...prev, [key]: parseFloat(value) }));
  };

  return (
    <div style={{ padding: '40px 20px', color: '#e0e0e0', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '0.05em', color: '#fff' }}>SYSTEM SETUP</h1>
        
        {/* Hardware Reset Button — only in local mode */}
        {mode === 'local' && (
        <button 
          onClick={handleResetDefaults}
          style={{
            background: 'linear-gradient(145deg, #222, #111)',
            border: '1px solid #000',
            color: '#888',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            fontSize: '0.8rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 1px 1px 1px rgba(255,255,255,0.05)',
            transition: 'all 0.1s'
          }}
          onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 2px 2px 5px rgba(0,0,0,0.8)'}
          onMouseUp={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5), inset 1px 1px 1px rgba(255,255,255,0.05)'}
        >
          Reset to Analog Defaults
        </button>
        )}
      </div>

      
      {/* 1. Visual Settings Rack */}
      <div className="settings-rack-panel" style={{ padding: '30px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Visual Outputs
        </h2>
        
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
          <label className="retro-toggle-wrapper" style={{ flexShrink: 0, marginTop: '2px' }}>
            <input type="checkbox" checked={texturesEnabled} onChange={handleToggle} />
            <span className="retro-toggle-slider"></span>
          </label>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#fff', marginBottom: '4px' }}>Enable Album Vinyl Textures</div>
            <div style={{ color: '#777', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Engages the custom overlay engines for album covers inside grids and carousels, simulating light reflection and physical wear.
            </div>
          </div>
        </div>
      </div>

      {/* 2. DJ & Dynamics Rack — Local mode only */}
      {mode === 'local' && (
      <div className="settings-rack-panel" style={{ padding: '30px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          DJ Performance & Dynamics
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          <div>
            <RetroFader 
              label="Tape Speed (Rate)" value={playbackRate.toFixed(2)} 
              min="0.25" max="2" step="0.05" onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} 
              unit="x" description="Physically slows the read speed, dropping pitch and tempo."
            />
            <RetroFader 
              label="Digital Pitch Shift" value={audioEffects.pitchShift} 
              min="-12" max="12" step="1" onChange={(e) => handleEffectChange('pitchShift', e.target.value)} 
              unit=" st" description="Phase vocoder shifting independent of playback time."
            />
            <RetroFader 
              label="1-Knob DJ Isolator Filter" value={audioEffects.djFilter || 0} 
              displayValue={getFilterLabel(audioEffects.djFilter || 0)}
              min="-1" max="1" step="0.01" onChange={(e) => handleEffectChange('djFilter', e.target.value)} 
              description="Sweep left to muffle (Low-pass), right to thin out (High-pass)."
              highlightColor={audioEffects.djFilter === 0 ? "#888" : "#38bdf8"}
            />
          </div>
          <div>
            <RetroFader 
              label="AutoWah Envelope" value={audioEffects.autoWah || 0} 
              displayValue={Math.round((audioEffects.autoWah || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('autoWah', e.target.value)} 
              unit="%" description="Dynamic funky filtering based on track volume."
            />
            <RetroFader 
              label="Sidechain Pump" value={audioEffects.sidechainPump || 0} 
              displayValue={Math.round((audioEffects.sidechainPump || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('sidechainPump', e.target.value)} 
              unit="%" description="EDM-style rhythmic volume ducking on the quarter note."
            />
          </div>
        </div>
      </div>
      )}

      {/* 3. Analog Tape & Lofi Rack — Local mode only */}
      {mode === 'local' && (
      <div className="settings-rack-panel" style={{ padding: '30px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Vintage Analog Textures
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          <div>
            <RetroFader 
              label="Wow & Flutter" value={audioEffects.wowFlutter || 0} 
              displayValue={Math.round((audioEffects.wowFlutter || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('wowFlutter', e.target.value)} 
              unit="%" description="Simulates warped records and imperfect motor belts."
            />
            <RetroFader 
              label="Harmonic Tape Saturation" value={audioEffects.tapeSaturation || 0} 
              displayValue={Math.round((audioEffects.tapeSaturation || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('tapeSaturation', e.target.value)} 
              unit="%" description="Non-linear, warm, thick magnetic distortion."
              highlightColor="#facc15"
            />
          </div>
          <div>
            <RetroFader 
              label="Lo-Fi BitCrusher" value={audioEffects.bitCrusher || 0} 
              displayValue={Math.round((audioEffects.bitCrusher || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('bitCrusher', e.target.value)} unit="%" 
            />
            <RetroFader 
              label="Distortion Crunch" value={audioEffects.distortion || 0} 
              displayValue={Math.round((audioEffects.distortion || 0) * 100)} 
              min="0" max="2" step="0.01" onChange={(e) => handleEffectChange('distortion', e.target.value)} 
              unit="%" highlightColor="#e35a5a" 
            />
            <div style={{ padding: '16px', background: '#111', borderRadius: '6px', border: '1px solid #222', marginTop: '16px' }}>
              <RetroFader 
                label="Synthetic Vinyl Crackle" value={audioEffects.vinylCrackle || 0}
                displayValue={Math.round((audioEffects.vinylCrackle || 0) * 100)} 
                min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('vinylCrackle', e.target.value)} 
                unit="%" highlightColor="#e35a5a" 
                description="Injects filtered pink noise directly into the master bus."
              />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 4. Mastering & Spatial Rack — Local mode only */}
      {mode === 'local' && (
      <div className="settings-rack-panel" style={{ padding: '30px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Spatial Imaging & Mastering
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          <div>
            <RetroFader 
              label="Stereo Widener" value={audioEffects.stereoWidth ?? 0.5} 
              displayValue={getStereoLabel(audioEffects.stereoWidth ?? 0.5)}
              min="0" max="1" step="0.05" onChange={(e) => handleEffectChange('stereoWidth', e.target.value)} 
              description="Pull left to collapse to Mono. Push right to expand past the headphones."
              highlightColor={audioEffects.stereoWidth === 0 ? "#888" : "#38bdf8"}
            />
            <RetroFader 
              label="LFO Auto-Panner" value={audioEffects.autoPan || 0} 
              displayValue={Math.round((audioEffects.autoPan || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('autoPan', e.target.value)} unit="%" 
            />
            <div style={{ height: '1px', background: '#222', margin: '24px 0' }} />
            <RetroFader label="EQ High (Treble)" value={audioEffects.eqHigh} min="-24" max="24" step="1" onChange={(e) => handleEffectChange('eqHigh', e.target.value)} unit=" dB" />
            <RetroFader label="EQ Mid" value={audioEffects.eqMid} min="-24" max="24" step="1" onChange={(e) => handleEffectChange('eqMid', e.target.value)} unit=" dB" />
            <RetroFader label="EQ Low (Bass)" value={audioEffects.eqLow} min="-24" max="24" step="1" onChange={(e) => handleEffectChange('eqLow', e.target.value)} unit=" dB" />
          </div>
          <div>
            <RetroFader 
              label="Chorus Intensity" value={audioEffects.chorus || 0} 
              displayValue={Math.round((audioEffects.chorus || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('chorus', e.target.value)} unit="%" 
            />
            <RetroFader 
              label="Phaser Intensity" value={audioEffects.phaser || 0} 
              displayValue={Math.round((audioEffects.phaser || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('phaser', e.target.value)} unit="%" 
            />
            <RetroFader 
              label="Feedback Delay" value={audioEffects.delay || 0} 
              displayValue={Math.round((audioEffects.delay || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('delay', e.target.value)} unit="%" 
            />
            <RetroFader 
              label="Global Sub-Reverb" value={audioEffects.reverb || 0} 
              displayValue={Math.round((audioEffects.reverb || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('reverb', e.target.value)} unit="%" 
            />
          </div>
        </div>
      </div>
      )}

      {/* 5. Spotify Integration */}
      <div className="settings-rack-panel" style={{ padding: '30px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Spotify Account Integration
        </h2>
        
        {spotifyUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: '#111', padding: '20px', borderRadius: '8px', border: '1px solid #222' }}>
            <img 
              src={spotifyUser.images?.[0]?.url || 'https://via.placeholder.com/64?text=S'} 
              alt="Spotify Avatar" 
              style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div>
              <p style={{ margin: '0 0 5px 0', color: '#1db954', fontWeight: 'bold', fontSize: '1.1rem' }}>Authenticated</p>
              <h3 style={{ margin: 0, color: '#fff' }}>{spotifyUser.display_name}</h3>
              <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '0.9rem' }}>Followers: {spotifyUser.followers?.total || 0}</p>
            </div>
            <div style={{ flex: 1, textAlign: 'right', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                onClick={() => window.open(spotifyUser.external_urls?.spotify, '_blank')}
                style={{ background: 'linear-gradient(145deg, #1ed760, #1db954)', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                View Profile
              </button>
              <button 
                type="button"
                onClick={async () => {
                  await fetch('/api/auth/logout');
                  setSpotifyUser(null);
                }}
                style={{ background: 'linear-gradient(145deg, #333, #222)', color: '#e35a5a', border: '1px solid #444', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: '#111', padding: '20px', borderRadius: '8px', border: '1px solid #222', textAlign: 'center' }}>
            <p style={{ color: '#888', marginBottom: '16px' }}>Not connected to Spotify or authentication token expired.</p>
            <a 
              href="/api/auth/login" 
              style={{ display: 'inline-block', background: 'linear-gradient(145deg, #1ed760, #1db954)', color: '#000', textDecoration: 'none', padding: '10px 24px', borderRadius: '24px', fontWeight: 'bold' }}
            >
              Connect Spotify
            </a>
          </div>
        )}
      </div>

    </div>
  );
}