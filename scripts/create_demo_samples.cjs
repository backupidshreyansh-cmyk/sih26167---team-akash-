const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

async function createSamples() {
  const dir = path.join(process.cwd(), 'public', 'samples');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const width = 512;
  const height = 512;

  // 1. OPTICAL PORT & URBAN SCENE
  // Water on left, land/city on right, docks, ships, vegetation
  const optical = new Jimp({ width, height, color: 0x1b3b5aff }); // Deep water blue
  
  // Draw land (coastal line from top to bottom roughly at x = 200)
  for (let y = 0; y < height; y++) {
    const coastX = 180 + Math.sin(y / 40) * 25 + Math.cos(y / 15) * 10;
    for (let x = Math.floor(coastX); x < width; x++) {
      // Land texture: mix of urban gray (0x7a838c) and green vegetation (0x3d6e35)
      const isGreen = ((x * 7 + y * 13) % 43) < 16;
      const isRoad = (y % 64 < 4) || (x % 64 < 4);
      let col = isRoad ? 0x475569ff : (isGreen ? 0x2e6930ff : 0x7c858eff);
      // Add slight noise
      const noise = ((x ^ y) % 15) - 7;
      optical.setPixelColor(col, x, y);
    }
  }

  // Draw port docks (piers extending into water)
  for (let pierY of [120, 240, 360]) {
    for (let py = pierY - 8; py <= pierY + 8; py++) {
      for (let px = 110; px <= 210; px++) {
        optical.setPixelColor(0x94a3b8ff, px, py);
      }
    }
    // Ship docked at pier (red/white container ship)
    for (let sy = pierY - 14; sy <= pierY - 2; sy++) {
      for (let sx = 90; sx <= 170; sx++) {
        optical.setPixelColor(0xb91c1cff, sx, sy);
      }
    }
  }
  // Ship in open water
  for (let sy = 280; sy <= 300; sy++) {
    for (let sx = 40; sx <= 90; sx++) {
      optical.setPixelColor(0xf1f5f9ff, sx, sy);
    }
  }

  await optical.write(path.join(dir, 'optical_port.png'));
  console.log('Created optical_port.png');

  // 2. SAR RADAR SCENE (Sentinel-1 SAR C-band)
  // Water is dark (specular reflection away from antenna)
  // Land is medium gray speckle
  // Ships and piers are bright double-bounce reflections (white/high backscatter)
  const sar = new Jimp({ width, height, color: 0x0f1115ff }); // Very dark calm sea

  for (let y = 0; y < height; y++) {
    const coastX = 180 + Math.sin(y / 40) * 25 + Math.cos(y / 15) * 10;
    // Sea speckle
    for (let x = 0; x < coastX; x++) {
      const seaNoise = Math.floor(Math.random() * 25);
      const col = (((seaNoise << 24) | (seaNoise << 16) | (seaNoise << 8) | 0xff) >>> 0);
      sar.setPixelColor(col, x, y);
    }
    // Land speckle (roughness returns ~ 80-140 gray)
    for (let x = Math.floor(coastX); x < width; x++) {
      const landVal = 85 + Math.floor(Math.random() * 55);
      const col = (((landVal << 24) | (landVal << 16) | (landVal << 8) | 0xff) >>> 0);
      sar.setPixelColor(col, x, y);
    }
  }

  // Strong double-bounce returns for piers & ships (intensity ~ 220-255)
  for (let pierY of [120, 240, 360]) {
    for (let py = pierY - 8; py <= pierY + 8; py++) {
      for (let px = 110; px <= 210; px++) {
        const bright = 200 + Math.floor(Math.random() * 55);
        sar.setPixelColor((((bright << 24) | (bright << 16) | (bright << 8) | 0xff) >>> 0), px, py);
      }
    }
    // Ship radar return (corner reflector effect)
    for (let sy = pierY - 14; sy <= pierY - 2; sy++) {
      for (let sx = 90; sx <= 170; sx++) {
        const bright = 230 + Math.floor(Math.random() * 25);
        sar.setPixelColor((((bright << 24) | (bright << 16) | (bright << 8) | 0xff) >>> 0), sx, sy);
      }
    }
  }
  // Ship in water (bright target against dark water)
  for (let sy = 280; sy <= 300; sy++) {
    for (let sx = 40; sx <= 90; sx++) {
      const bright = 240 + Math.floor(Math.random() * 15);
      sar.setPixelColor((((bright << 24) | (bright << 16) | (bright << 8) | 0xff) >>> 0), sx, sy);
    }
  }

  await sar.write(path.join(dir, 'sar_radar.png'));
  console.log('Created sar_radar.png');

  // 3. BI-TEMPORAL T1 (BEFORE FLOOD)
  // Green flood plain, river within normal boundaries
  const t1 = new Jimp({ width, height, color: 0x3d6e35ff }); // Green pasture
  // River path
  for (let y = 0; y < height; y++) {
    const riverCenter = 256 + Math.sin(y / 60) * 80;
    for (let x = 0; x < width; x++) {
      const dist = Math.abs(x - riverCenter);
      if (dist < 18) {
        // River channel
        t1.setPixelColor(0x1e3a5fff, x, y);
      } else {
        // Agricultural parcels
        const parcel = Math.floor(x / 64) + Math.floor(y / 64);
        const col = parcel % 3 === 0 ? 0x4d7c0fff : (parcel % 3 === 1 ? 0x854d0eff : 0x15803dff);
        t1.setPixelColor(col, x, y);
      }
    }
  }
  await t1.write(path.join(dir, 'bitemporal_before.png'));
  console.log('Created bitemporal_before.png');

  // 4. BI-TEMPORAL T2 (AFTER FLOOD)
  // River has expanded by 4x, inundating low lying fields
  const t2 = new Jimp({ width, height, color: 0x3d6e35ff });
  for (let y = 0; y < height; y++) {
    const riverCenter = 256 + Math.sin(y / 60) * 80;
    for (let x = 0; x < width; x++) {
      const dist = Math.abs(x - riverCenter);
      // Flooded extent
      if (dist < 85) {
        // Turbid muddy flood water
        const floodCol = dist < 22 ? 0x1e3a5fff : 0x5b4731ff;
        t2.setPixelColor(floodCol, x, y);
      } else {
        const parcel = Math.floor(x / 64) + Math.floor(y / 64);
        const col = parcel % 3 === 0 ? 0x4d7c0fff : (parcel % 3 === 1 ? 0x854d0eff : 0x15803dff);
        t2.setPixelColor(col, x, y);
      }
    }
  }
  await t2.write(path.join(dir, 'bitemporal_after.png'));
  console.log('Created bitemporal_after.png');
}

createSamples().catch(console.error);
