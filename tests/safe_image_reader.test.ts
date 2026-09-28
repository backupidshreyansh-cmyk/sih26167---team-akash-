import { describe, it, expect } from 'vitest';
import { Jimp } from 'jimp';
import { cleanBase64, sanitizePngBuffer, safeReadJimp } from '../server/utils/safeImageReader.js';
import { DeterministicEngine } from '../server/analysis/deterministicEngine.js';
import { NormalizedImage } from '../server/imagery/types.js';

describe('SafeImageReader and Stream Resilience', () => {
  it('cleanBase64 removes data URI headers, newlines, and whitespace', () => {
    const raw = '  data:image/png;base64,\r\niVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjDAGJAYAH20D/y8y3UIAAAAASUVORK5CYII=\n  ';
    const cleaned = cleanBase64(raw);
    expect(cleaned).toBe('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjDAGJAYAH20D/y8y3UIAAAAASUVORK5CYII=');
  });

  it('sanitizePngBuffer removes trailing garbage after IEND chunk', async () => {
    const testJimp = new Jimp({ width: 4, height: 4, color: 0xFF0000FF });
    const cleanBuf = await testJimp.getBuffer('image/png');
    
    // Append trailing garbage that normally causes pngjs to throw "unrecognised content at end of stream"
    const dirtyBuf = Buffer.concat([cleanBuf, Buffer.from('TRAILING_GARBAGE_BYTES_123456789')]);

    // Unsanitized buffer throws in standard Jimp.read
    let standardFailed = false;
    try {
      await Jimp.read(dirtyBuf);
    } catch (err: any) {
      standardFailed = true;
      expect(err.message).toContain('unrecognised content at end of stream');
    }
    expect(standardFailed).toBe(true);

    // Sanitized buffer succeeds
    const cleaned = sanitizePngBuffer(dirtyBuf);
    const readJimp = await Jimp.read(cleaned);
    expect(readJimp.bitmap.width).toBe(4);
    expect(readJimp.bitmap.height).toBe(4);
  });

  it('safeReadJimp succeeds directly on dirty buffer and dirty base64', async () => {
    const testJimp = new Jimp({ width: 6, height: 6, color: 0x00FF00FF });
    const cleanBuf = await testJimp.getBuffer('image/png');
    const dirtyBuf = Buffer.concat([cleanBuf, Buffer.from('\0\0\0\0EXTRA_ZEROES')]);

    const resFromBuf = await safeReadJimp(dirtyBuf);
    expect(resFromBuf.bitmap.width).toBe(6);

    const dirtyBase64 = 'data:image/png;base64,' + dirtyBuf.toString('base64');
    const resFromB64 = await safeReadJimp(dirtyBase64);
    expect(resFromB64.bitmap.width).toBe(6);
  });

  it('DeterministicEngine.analyzeImage succeeds on image with trailing bytes without fallback', async () => {
    const testJimp = new Jimp({ width: 8, height: 8, color: 0x0000FFFF });
    const cleanBuf = await testJimp.getBuffer('image/png');
    const dirtyBuf = Buffer.concat([cleanBuf, Buffer.from('END_OF_STREAM_DIRTY_DATA')]);

    const normalized: NormalizedImage = {
      id: 'test_dirty_img',
      filename: 'dirty.png',
      mimeType: 'image/png',
      sizeBytes: dirtyBuf.length,
      width: 8,
      height: 8,
      bandCount: 3,
      modality: 'OPTICAL',
      temporalRole: 'PRIMARY',
      acquisitionTime: null,
      geospatialMetadata: null,
      sourceBase64: dirtyBuf.toString('base64')
    };

    const metrics = await DeterministicEngine.analyzeImage(normalized);
    expect(metrics.width).toBe(8);
    expect(metrics.height).toBe(8);
    expect(typeof metrics.meanBrightness).toBe('number');
    expect(metrics.meanBrightness).toBeGreaterThan(0);
  });

  it('safeReadJimp handles SVG string or buffer without crashing', async () => {
    const svg = '<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="#123b5d"/></svg>';
    const res = await safeReadJimp(Buffer.from(svg));
    expect(res.bitmap.width).toBe(64);
    expect(res.bitmap.height).toBe(64);
  });
});
