import React, { useState, useEffect } from 'react';
import { useLocalPlayer } from '../state/LocalPlayerContext';
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
// Reusable Fader Component for DRY code
// ----------------------------------------------------------------------------
const RetroFader = ({ label, value, min, max, step, onChange, unit = "", highlightColor = "#38bdf8", description }) => (
  <div style={{ marginBottom: '24px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
      <div>
        <span style={{ fontWeight: '600', color: '#ccc', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.85rem' }}>{label}</span>
        {description && <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '4px' }}>{description}</div>}
      </div>
      <span className="lcd-readout" style={{ color: highlightColor, fontWeight: 'bold', fontSize: '0.9rem' }}>
        {value}{unit}
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

  const handleResetDefaults = () => {
    setPlaybackRate(1);
    setAudioEffects({
      eqHigh: 0, eqMid: 0, eqLow: 0, 
      distortion: 0, reverb: 0, vinylCrackle: 0, 
      pitchShift: 0, chorus: 0, phaser: 0, 
      bitCrusher: 0, delay: 0
    });
  };

  return (
    <div style={{ padding: '40px 20px', color: '#e0e0e0', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '0.05em', color: '#fff' }}>SYSTEM SETUP</h1>
        
        {/* Hardware Reset Button */}
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
      </div>
      
      {/* Visual Settings Rack */}
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

      {/* Audio Engine Rack */}
      <div className="settings-rack-panel" style={{ padding: '30px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          DSP Master Bus
        </h2>
        <p style={{ marginTop: '0', marginBottom: '32px', color: '#666', fontSize: '0.85rem', lineHeight: '1.5', fontStyle: 'italic' }}>
          Audio routed through multi-node Tone.js limiter block. Adjustments apply globally to the playback engine.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          
          {/* Left Column */}
          <div>
            <RetroFader 
              label="Tape Speed (Rate)" 
              value={playbackRate.toFixed(2)} 
              min="0.25" max="2" step="0.05" 
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} 
              unit="x"
              description="Physically slows the read speed, dropping pitch and tempo."
            />
            
            <RetroFader 
              label="Digital Pitch Shift" 
              value={audioEffects.pitchShift} 
              min="-12" max="12" step="1" 
              onChange={(e) => handleEffectChange('pitchShift', e.target.value)} 
              unit=" st"
              description="Phase vocoder shifting independent of playback time."
            />

            <div style={{ height: '1px', background: '#222', margin: '24px 0' }} /> {/* Divider */}

            <RetroFader label="EQ High (Treble)" value={audioEffects.eqHigh} min="-24" max="24" step="1" onChange={(e) => handleEffectChange('eqHigh', e.target.value)} unit=" dB" />
            <RetroFader label="EQ Mid" value={audioEffects.eqMid} min="-24" max="24" step="1" onChange={(e) => handleEffectChange('eqMid', e.target.value)} unit=" dB" />
            <RetroFader label="EQ Low (Bass)" value={audioEffects.eqLow} min="-24" max="24" step="1" onChange={(e) => handleEffectChange('eqLow', e.target.value)} unit=" dB" />
          </div>

          {/* Right Column */}
          <div>
            <RetroFader label="Chorus Intensity" value={(audioEffects.chorus * 100).toFixed(0)} min="0" max="1" step="0.05" onChange={(e) => handleEffectChange('chorus', e.target.value)} unit="%" />
            <RetroFader label="Phaser Intensity" value={(audioEffects.phaser * 100).toFixed(0)} min="0" max="1" step="0.05" onChange={(e) => handleEffectChange('phaser', e.target.value)} unit="%" />
            <RetroFader label="Lo-Fi BitCrusher" value={(audioEffects.bitCrusher * 100).toFixed(0)} min="0" max="1" step="0.05" onChange={(e) => handleEffectChange('bitCrusher', e.target.value)} unit="%" />
            <RetroFader label="Feedback Delay" value={(audioEffects.delay * 100).toFixed(0)} min="0" max="1" step="0.05" onChange={(e) => handleEffectChange('delay', e.target.value)} unit="%" />
            <RetroFader label="Distortion Crunch" value={(audioEffects.distortion * 100).toFixed(0)} min="0" max="2" step="0.05" onChange={(e) => handleEffectChange('distortion', e.target.value)} unit="%" highlightColor="#e35a5a" />
            <RetroFader label="Global Sub-Reverb" value={(audioEffects.reverb * 100).toFixed(0)} min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('reverb', e.target.value)} unit="%" />
            
            <div style={{ padding: '16px', background: '#111', borderRadius: '6px', border: '1px solid #222', marginTop: '16px' }}>
              <RetroFader 
                label="Synthetic Vinyl Crackle" 
                value={Math.round(audioEffects.vinylCrackle * 100)} 
                min="0" max="1" step="0.01" 
                onChange={(e) => handleEffectChange('vinylCrackle', e.target.value)} 
                unit="%" 
                highlightColor="#e35a5a" 
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}