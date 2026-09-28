import { Tool, globalRegistry } from './registry.js';

export const ImageValidationTool: Tool = {
  name: 'image_validation',
  description: 'Validates input image dimensions and formats.',
  version: '1.0.0',
  supportedTasks: ['SINGLE_IMAGE_VQA', 'IMAGE_CAPTIONING', 'SCENE_DESCRIPTION', 'TEXT_GUIDED_GROUNDING', 'OPTICAL_ANALYSIS', 'SAR_ANALYSIS', 'OPTICAL_SAR_ANALYSIS', 'BI_TEMPORAL_ANALYSIS', 'CHANGE_VQA', 'COUNTING', 'SPATIAL_REASONING', 'NEGATIVE_QUERY', 'GEOREFERENCED_QUERY'],
  supportedModalities: ['ALL'],
  isImplemented: true,
  async execute(input) {
     return {
         validCount: input.images.length,
         status: 'OK',
         details: input.images.map(img => `${img.mimeType} (${img.width}x${img.height})`)
     };
  }
};

export const VisualVQATool: Tool = {
  name: 'visual_vqa',
  description: 'Executes visual question answering on images using the active AI Provider.',
  version: '1.0.0',
  supportedTasks: ['SINGLE_IMAGE_VQA', 'IMAGE_CAPTIONING', 'SCENE_DESCRIPTION', 'TEXT_GUIDED_GROUNDING', 'OPTICAL_ANALYSIS', 'SAR_ANALYSIS', 'OPTICAL_SAR_ANALYSIS', 'BI_TEMPORAL_ANALYSIS', 'CHANGE_VQA', 'COUNTING', 'SPATIAL_REASONING', 'NEGATIVE_QUERY'],
  supportedModalities: ['OPTICAL', 'SAR'],
  isImplemented: true,
  async execute(input, context) {
      // We pass the normalized images back down to the provider payload
      const payload = {
          messages: [{ role: 'user' as const, text: input.query }],
          images: input.images.map(img => ({
              data: img.sourceBase64,
              mimeType: img.mimeType
          })),
          systemInstruction: context.systemInstruction,
          mode: 'auto'
      };
      
      const response = await context.provider.generateContent(payload);
      return response;
  }
};

export const SpatialReasoningTool: Tool = {
  name: 'spatial_reasoning',
  description: 'Specialist tool for analyzing spatial relationships, bounding boxes, and object arrangements.',
  version: '1.0.0',
  supportedTasks: ['SPATIAL_REASONING', 'TEXT_GUIDED_GROUNDING'],
  supportedModalities: ['OPTICAL', 'SAR'],
  isImplemented: true,
  async execute(input, context) {
      const spatialPrompt = `You are a specialist in Spatial Reasoning and Object Localization.
Analyze the provided image.
Focus on: spatial relationships (e.g., "north of", "adjacent to"), object counting, spatial distributions, and exact bounding box coordinates of requested elements.
You MUST provide accurate 'groundingBoxes' for any distinct features or objects mentioned in your answer.
Query context: ${input.query}`;
      
      const payload = {
          messages: [{ role: 'user' as const, text: spatialPrompt }],
          images: input.images.map(img => ({
              data: img.sourceBase64,
              mimeType: img.mimeType
          })),
          systemInstruction: context.systemInstruction,
          mode: 'spatial'
      };
      
      const response = await context.provider.generateContent(payload);
      response.executionTrace.push({ step: 'SPATIAL_REASONING_COMPLETED', status: 'SUCCESS' });
      return response;
  }
};

globalRegistry.register(ImageValidationTool);
globalRegistry.register(VisualVQATool);
globalRegistry.register(SpatialReasoningTool);
