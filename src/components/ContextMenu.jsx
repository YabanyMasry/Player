import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import './ContextMenu.css';

export default function ContextMenu({ x, y, options, onClose }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useEffect(() => {
    setPosition({ left: x, top: y });
  }, [x, y]);

  useLayoutEffect(() => {
    if (menuRef.current && x !== 0 && y !== 0) {
      const rect = menuRef.current.getBoundingClientRect();
      const updatedPos = { left: x, top: y };
      
      // Keep menu from going off bottom bounds
      if (y + rect.height > window.innerHeight) {
        updatedPos.top = Math.max(0, window.innerHeight - rect.height - 10);
      }
      // Keep menu from going off right bounds
      if (x + rect.width > window.innerWidth) {
        updatedPos.left = Math.max(0, window.innerWidth - rect.width - 10);
      }
      setPosition(updatedPos);
    }
  }, [x, y, options]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEsc = (e) => e.key === 'Escape' && onClose();
    
    // Use timeout to prevent instant close from the mousedown that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }, 0);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (x === 0 && y === 0) return null;

  return (
    <div 
      className="context-menu" 
      ref={menuRef} 
      style={{ left: position.left, top: position.top }}
    >
      {options.map((option, idx) => {
        if (option.divider) {
          return <div key={idx} className="context-menu-divider" />;
        }

        if (option.submenu) {
          return (
            <div key={idx} className="context-menu-item has-submenu">
              <span>{option.label}</span>
              <span className="submenu-arrow">▶</span>
              <div className="context-submenu">
                {option.submenu.length === 0 ? (
                   <div className="context-menu-item disabled">None</div>
                ) : (
                  option.submenu.map((sub, sIdx) => (
                    <div 
                      key={sIdx} 
                      className={`context-menu-item ${sub.disabled ? 'disabled' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!sub.disabled && sub.onClick) {
                          sub.onClick();
                          onClose();
                        }
                      }}
                    >
                      {sub.label}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        }

        return (
          <div 
            key={idx} 
            className={`context-menu-item ${option.disabled ? 'disabled' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!option.disabled && option.onClick) {
                option.onClick();
                onClose();
              }
            }}
          >
            {option.label}
          </div>
        );
      })}
    </div>
  );
}
