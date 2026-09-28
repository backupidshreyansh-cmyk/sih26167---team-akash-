import { Jimp } from 'jimp';

export interface ProcessedSAR {
  base64Data: string;
  mimeType: string;
}

/**
 * Reads TIFF raster data, normalizes it into a grayscale PNG buffer,
 * and ensures the resulting visualization is suitable for the Gemini API.
 */
export async function processSARImage(
  rasterData: any, // Float32Array, Uint16Array, etc.
  width: number,
  height: number
): Promise<ProcessedSAR> {
  let min = Infinity;
  let max = -Infinity;
  
  // Subsample for min/max to avoid blocking if image is huge
  const step = Math.max(1, Math.floor(rasterData.length / 100000));
  for (let i = 0; i < rasterData.length; i += step) {
      const val = rasterData[i];
      if (val < min) min = val;
      if (val > max) max = val;
  }
  
  const rgbaBuffer = Buffer.alloc(width * height * 4);
  const range = max - min === 0 ? 1 : max - min;
  
  for (let i = 0; i < rasterData.length; i++) {
      const val = rasterData[i];
      // Robust contrast stretch (clamp to 0-255)
      let normalized = Math.floor(((val - min) / range) * 255);
      if (normalized < 0) normalized = 0;
      if (normalized > 255) normalized = 255;
      
      const idx = i * 4;
      rgbaBuffer[idx] = normalized;     // R
      rgbaBuffer[idx + 1] = normalized; // G
      rgbaBuffer[idx + 2] = normalized; // B
      rgbaBuffer[idx + 3] = 255;        // A
  }
  
  let jimpImg: any = new Jimp({ width, height, data: rgbaBuffer });
  
  // Resize if too large to prevent Gemini payload errors (max ~2048x2048 recommended for visual processing)
  if (width > 2048 || height > 2048) {
      const scale = 2048 / Math.max(width, height);
      jimpImg = jimpImg.resize({ w: Math.floor(width * scale), h: Math.floor(height * scale) });
  }
  
  const pngBase64Uri = await jimpImg.getBase64('image/png');
  const rawBase64 = pngBase64Uri.split(',')[1];
  const pngBuf = Buffer.from(rawBase64.replace(/[\r\n\s]/g, ''), 'base64');
  
  return {
    base64Data: pngBuf.toString('base64'),
    mimeType: 'image/png'
  };
}
