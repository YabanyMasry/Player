import { useState, useEffect } from 'react';

// targetWidth/targetHeight should exactly match your VinylPlayer's fixed CSS
export const usePlayerScale = (targetWidth, targetHeight) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      // Subtracting roughly 350px for the tracklist width and 150px for the footer
      // Adjust these subtraction values based on your actual CSS sizes
      const availableWidth = window.innerWidth - 350; 
      const availableHeight = window.innerHeight - 150; 

      const widthRatio = availableWidth / targetWidth;
      const heightRatio = availableHeight / targetHeight;
      
      // Use Math.min to ensure it fits, but cap it at 1 so it doesn't get pixelated
      // on massive 4k screens.
      setScale(Math.min(widthRatio, heightRatio, 1));
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [targetWidth, targetHeight]);

  return scale;
};