import React, { useState, useEffect } from 'react';
import { useLocalPlayer } from '../state/LocalPlayerContext';

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

export default function SettingsPage() {
  const [texturesEnabled, setTexturesEnabled] = useState(true);
  
  // This hook context passes down the global state of the audio chain
  const { audioEffects, setAudioEffects, playbackRate, setPlaybackRate } = useLocalPlayer();

  useEffect(() => {
    const cookieVal = getCookie('enableAlbumTextures');
    if (cookieVal === 'false') {
      setTexturesEnabled(false);
    }
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
    <div style={{ padding: '40px', color: '#fff', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '40px' }}>Settings</h1>
      
      <div style={{ marginBottom: '40px', background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '20px' }}>Visual Settings</h2>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '12px' }}>
          <input 
            type="checkbox" 
            checked={texturesEnabled} 
            onChange={handleToggle} 
            style={{ width: '20px', height: '20px', accentColor: '#38bdf8' }}
          />
          <span style={{ fontSize: '1.1rem' }}>Enable Album Vinyl Textures</span>
        </label>
        <p style={{ marginTop: '10px', color: '#aaa', fontSize: '0.9rem', lineHeight: '1.4' }}>
          Turns on or off the custom Photoshop-style overlay effects for the album covers inside the grids and carousels.
        </p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '24px' }}>Audio Mastering & Pedalboard (Tone.js)</h2>
        
        <p style={{ marginTop: '0', marginBottom: '24px', color: '#aaa', fontSize: '0.9rem', lineHeight: '1.4' }}>
          Your global master bus is routed directly through a Tone.js multi-node limiter block. Dial in effects without clipping!
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Tape Speed / Playback Rate */}
          <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>Analog Tape Speed (Playback Rate)</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{playbackRate.toFixed(2)}x</span>
            </div>
            <p style={{ marginTop: '0', marginBottom: '12px', color: '#888', fontSize: '0.85rem' }}>
              Like slowing down a real tape, modifying this fundamentally bends the interval and cadence simultaneously. 
            </p>
            <input type="range" min="0.25" max="2" step="0.05" value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* Pitch Shift */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Digital Pitch Shift</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{audioEffects.pitchShift} semitones</span>
            </div>
            <p style={{ marginTop: '0', marginBottom: '12px', color: '#888', fontSize: '0.85rem' }}>
              Uses a phase vocoder to shift the pitch completely independently of the time/speed.
            </p>
            <input type="range" min="-12" max="12" step="1" value={audioEffects.pitchShift} onChange={(e) => handleEffectChange('pitchShift', e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* EQ Low */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>EQ Low (Bass)</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{audioEffects.eqLow} dB</span>
            </div>
            <input type="range" min="-24" max="24" step="1" value={audioEffects.eqLow} onChange={(e) => handleEffectChange('eqLow', e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* EQ Mid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>EQ Mid</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{audioEffects.eqMid} dB</span>
            </div>
            <input type="range" min="-24" max="24" step="1" value={audioEffects.eqMid} onChange={(e) => handleEffectChange('eqMid', e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* EQ High */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>EQ High (Treble)</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{audioEffects.eqHigh} dB</span>
            </div>
            <input type="range" min="-24" max="24" step="1" value={audioEffects.eqHigh} onChange={(e) => handleEffectChange('eqHigh', e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* Chorus */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Chorus Intensity (Wet)</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{(audioEffects.chorus * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={audioEffects.chorus} onChange={(e) => handleEffectChange('chorus', e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* Phaser */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Phaser Intensity (Wet)</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{(audioEffects.phaser * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={audioEffects.phaser} onChange={(e) => handleEffectChange('phaser', e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* Bit Crusher */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Lo-Fi BitCrusher</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{(audioEffects.bitCrusher * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={audioEffects.bitCrusher} onChange={(e) => handleEffectChange('bitCrusher', e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* Delay */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Feedback Space Delay (Echo)</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{(audioEffects.delay * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={audioEffects.delay} onChange={(e) => handleEffectChange('delay', e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* Distortion */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Distortion Crunch</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{(audioEffects.distortion * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="2" step="0.05" value={audioEffects.distortion} onChange={(e) => handleEffectChange('distortion', e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* Reverb */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Global Sub-Reverb (Wet/Dry)</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{(audioEffects.reverb * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.01" value={audioEffects.reverb} onChange={(e) => handleEffectChange('reverb', e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          {/* Vinyl Crackle */}
          <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#e35a5a', fontWeight: 'bold' }}>Synthetic Vinyl Crackle & Dust</span>
              <span style={{ color: '#e35a5a', fontWeight: 'bold' }}>{Math.round(audioEffects.vinylCrackle * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.01" value={audioEffects.vinylCrackle} onChange={(e) => handleEffectChange('vinylCrackle', e.target.value)} style={{ width: '100%', accentColor: '#e35a5a' }} />
          </div>
          
        </div>
      </div>
    </div>
  );
}
