import React from 'react';
import { Link } from 'react-router-dom';
import './StudioNav.css';
import './TitleBar.css'; // For the embedded window controls

export default function StudioNav({ 
  items = [], 
  activeHref, 
  className = '' 
}) {
  return (
    <div className={`vp-studio-nav-container ${className}`} style={{ WebkitAppRegion: 'drag', display: 'flex', alignItems: 'flex-start', paddingTop: '10px' }}>
      <nav className="vp-studio-nav-plate" style={{ WebkitAppRegion: 'no-drag' }}>
        {/* The Input Channels */}
        <div className="vp-nav-channels">
          {items.map((item) => {
            const isActive = activeHref === item.href || (activeHref.startsWith(item.href) && item.href !== '/');
            return (
              <Link 
                key={item.href} 
                to={item.href} 
                className={`vp-nav-btn ${isActive ? 'vp-nav-btn--active' : ''}`}
                draggable="false"
              >
                <span className="vp-nav-led"></span>
                {item.label}
              </Link>
            );
          })}

          {/* Embedded Window Controls mixed directly into the pill UI! */}
          {window.electronAPI && (
            <>
              <div style={{ width: '1px', background: '#222', margin: '4px 8px', boxShadow: '1px 0 0 rgba(255,255,255,0.05)' }} />
              <div className="titlebar-controls" style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                <button className="control-btn minimize" onClick={() => window.electronAPI.minimize()} style={{ width: '32px', height: '100%' }}>
                  <span>&minus;</span>
                </button>
                <button className="control-btn maximize" onClick={() => window.electronAPI.maximize()} style={{ width: '32px', height: '100%' }}>
                  <span style={{ fontSize: '10px' }}>&#10064;</span>
                </button>
                <button className="control-btn close" onClick={() => window.electronAPI.close()} style={{ width: '32px', height: '100%', borderTopRightRadius: '2px', borderBottomRightRadius: '2px' }}>
                  <span>&#10005;</span>
                </button>
              </div>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}