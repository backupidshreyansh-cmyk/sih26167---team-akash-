import { describe, it, expect } from 'vitest';
import { globalRegistry } from '../server/tools/registry.js';
import '../server/tools/coreTools.js';
import '../server/tools/specialistTools.js';

describe('Tool Registry', () => {
  it('should register visual_vqa and other core tools', () => {
    const vqaTool = globalRegistry.get('visual_vqa');
    expect(vqaTool).toBeDefined();
    expect(vqaTool?.name).toBe('visual_vqa');
    
    const sarTool = globalRegistry.get('sar_analysis');
    expect(sarTool).toBeDefined();
    
    const opticalTool = globalRegistry.get('optical_analysis');
    expect(opticalTool).toBeDefined();
  });
});
