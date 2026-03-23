import React from 'react';
import { Link } from 'react-router-dom';
import './StudioNav.css';

export default function StudioNav({ 
  items = [], 
  activeHref, 
  className = '' 
}) {
  return (
    <div className={`vp-studio-nav-container ${className}`}>
      <nav className="vp-studio-nav-plate">
        
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
                {/* The glowing LED indicator for the active channel */}
                <span className="vp-nav-led"></span>
                {item.label}
              </Link>
            );
          })}
        </div>

      </nav>
    </div>
  );
}