/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Local Vision-Language Embedding Model Specification (Phase 2).
 * Formulated for 100% offline, local edge execution on an RTX 4050 6GB GPU or 24GB CPU.
 */

export interface ModelSpec {
  modelName: string;
  version: string;
  architecture: string;
  source: string;
  license: string;
  dimension: number;
  maxSequenceLength: number;
  modelSizeBytesMb: number;
  expectedVramMb: number;
  expectedRamMb: number;
  supportsTextEmbedding: boolean;
  supportsImageEmbedding: boolean;
  localWeightsRelativePath: string;
  remoteSensingTrained: boolean;
  normalization: {
    mean: [number, number, number];
    std: [number, number, number];
    inputResolution: [number, number]; // [width, height]
  };
}

export const LOCAL_EMBEDDING_MODEL_SPEC: ModelSpec = {
  modelName: 'RemoteCLIP-ViT-B-32-Local',
  version: '1.2.0',
  architecture: 'Dual Vision-Language Transformer (Dual Encoder)',
  source: 'RemoteCLIP: A Vision Language Foundation Model for Remote Sensing (Open Source)',
  license: 'MIT License',
  dimension: 512,
  maxSequenceLength: 77,
  modelSizeBytesMb: 338,
  expectedVramMb: 1200, // ~1.2 GB VRAM footprint (comfortably within 6 GB RTX 4050)
  expectedRamMb: 1800,  // ~1.8 GB RAM footprint (comfortably within 24 GB RAM)
  supportsTextEmbedding: true,
  supportsImageEmbedding: true,
  localWeightsRelativePath: 'models/embeddings/remoteclip-vit-b-32/',
  remoteSensingTrained: true,
  normalization: {
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    inputResolution: [224, 224]
  }
};
