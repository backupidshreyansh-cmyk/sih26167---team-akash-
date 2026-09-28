import { describe, it, expect } from 'vitest';
import { validateAndNormalizeGroundingBoxes } from '../server/utils/grounding.js';

describe('Grounding Box Validation and Normalization', () => {
  it('should pass and normalize valid grounding boxes', () => {
    const input = [
      { ymin: 100, xmin: 200, ymax: 500, xmax: 600, label: 'Building' },
      { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000, label: 'Full Image' }
    ];
    
    const result = validateAndNormalizeGroundingBoxes(input);
    expect(result).toHaveLength(2);
    
    expect(result[0]).toEqual({
      ymin: 0.1,
      xmin: 0.2,
      ymax: 0.5,
      xmax: 0.6,
      label: 'Building'
    });
    
    expect(result[1]).toEqual({
      ymin: 0.0,
      xmin: 0.0,
      ymax: 1.0,
      xmax: 1.0,
      label: 'Full Image'
    });
  });

  it('should return empty array for undefined or non-array input', () => {
    expect(validateAndNormalizeGroundingBoxes(undefined)).toEqual([]);
    expect(validateAndNormalizeGroundingBoxes(null as any)).toEqual([]);
    expect(validateAndNormalizeGroundingBoxes("not an array" as any)).toEqual([]);
  });

  it('should return empty array when no reliable grounding is possible (empty input)', () => {
    expect(validateAndNormalizeGroundingBoxes([])).toEqual([]);
  });

  it('should filter out out-of-range coordinates', () => {
    const input = [
      { ymin: -10, xmin: 50, ymax: 100, xmax: 200, label: 'Negative ymin' },
      { ymin: 0, xmin: 0, ymax: 1001, xmax: 500, label: 'Over 1000 ymax' },
      { ymin: 100, xmin: 100, ymax: 200, xmax: 300, label: 'Valid Box' }
    ];
    
    const result = validateAndNormalizeGroundingBoxes(input);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Valid Box');
  });

  it('should filter out reversed coordinates', () => {
    const input = [
      { ymin: 500, xmin: 100, ymax: 200, xmax: 300, label: 'ymin > ymax' },
      { ymin: 100, xmin: 300, ymax: 200, xmax: 100, label: 'xmin > xmax' },
      { ymin: 100, xmin: 100, ymax: 100, xmax: 200, label: 'ymin == ymax' },
      { ymin: 10, xmin: 10, ymax: 20, xmax: 20, label: 'Valid Box' }
    ];
    
    const result = validateAndNormalizeGroundingBoxes(input);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Valid Box');
  });

  it('should filter out boxes with missing or empty labels', () => {
    const input = [
      { ymin: 10, xmin: 10, ymax: 20, xmax: 20, label: '' },
      { ymin: 10, xmin: 10, ymax: 20, xmax: 20, label: '   ' },
      { ymin: 10, xmin: 10, ymax: 20, xmax: 20 },
      { ymin: 10, xmin: 10, ymax: 20, xmax: 20, label: 'Valid Box' }
    ];
    
    const result = validateAndNormalizeGroundingBoxes(input);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Valid Box');
  });

  it('should filter out malformed or missing coordinate properties', () => {
    const input = [
      { ymin: "100", xmin: 100, ymax: 200, xmax: 300, label: 'String coordinate' },
      { xmin: 100, ymax: 200, xmax: 300, label: 'Missing ymin' },
      { ymin: 10, xmin: 10, ymax: 20, xmax: 20, label: 'Valid Box' },
      null,
      "random string"
    ];
    
    const result = validateAndNormalizeGroundingBoxes(input);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Valid Box');
  });
});
