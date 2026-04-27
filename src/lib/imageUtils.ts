/**
 * Compresses and resizes an image to the specified dimensions using canvas.
 * @param base64OrFile The image source (base64 string or File object).
 * @param maxWidth The target width.
 * @param maxHeight The target height.
 * @param quality The compression quality (0 to 1).
 * @returns A promise that resolves to the compressed image as a base64 string.
 */
export const compressImage = (
  base64OrFile: string | File,
  maxWidth: number = 400,
  maxHeight: number = 500,
  quality: number = 0.7
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Keep aspect ratio but fit within maxWidth/maxHeight
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = width * ratio;
      height = height * ratio;

      // Force to exact dimensions if user strictly wants 400x500 (with potential cropping or stretching)
      // The user asked for "resize to 400x500 pixels", usually this implies fixing the size.
      // But simple aspect ratio fit is safer for quality.
      // However, for passports, a fixed size might be better.
      
      canvas.width = maxWidth;
      canvas.height = maxHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw image to fill the canvas (cover effect)
      const imgRatio = img.width / img.height;
      const canvasRatio = maxWidth / maxHeight;
      
      let drawWidth, drawHeight, offsetX, offsetY;
      
      if (imgRatio > canvasRatio) {
        drawHeight = maxHeight;
        drawWidth = img.width * (maxHeight / img.height);
        offsetX = (maxWidth - drawWidth) / 2;
        offsetY = 0;
      } else {
        drawWidth = maxWidth;
        drawHeight = img.height * (maxWidth / img.width);
        offsetX = 0;
        offsetY = (maxHeight - drawHeight) / 2;
      }

      ctx.fillStyle = '#1A1A1E'; // Dark background for empty space
      ctx.fillRect(0, 0, maxWidth, maxHeight);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = (err) => {
      reject(err);
    };

    if (typeof base64OrFile === 'string') {
      img.src = base64OrFile;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(base64OrFile);
    }
  });
};
