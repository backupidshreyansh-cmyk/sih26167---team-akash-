import { Tool, globalRegistry } from './registry.js';
import { AIProviderResponse } from '../providers/AIProvider.js';

export const OpticalAnalysisTool: Tool = {
  name: 'optical_analysis',
  description: 'Specialist tool for analyzing optical imagery (visible color, texture, shape, vegetation, water, etc.).',
  version: '1.0.0',
  supportedTasks: ['OPTICAL_ANALYSIS', 'OPTICAL_SAR_ANALYSIS', 'BI_TEMPORAL_ANALYSIS'],
  supportedModalities: ['OPTICAL'],
  isImplemented: true,
  async execute(input, context): Promise<AIProviderResponse> {
      const metadataContext = input.images.map(img => {
          let str = `Image Modality: ${img.modality}`;
          if (img.width && img.height) str += `, Dimensions: ${img.width}x${img.height}`;
          if (img.bandCount) str += `, Bands: ${img.bandCount}`;
          return str;
      }).join('\n');

      const opticalPrompt = `You are a specialist in Optical Remote Sensing.
Analyze the provided optical image.
Focus on: visible colour, texture, shape, spatial arrangement, vegetation appearance, water appearance, built structures, roads, agricultural patterns, clouds, and shadows.
If only RGB is available, state that. Do not claim spectral indices like NDVI unless explicitly provided.
METADATA:
${metadataContext}

Query context: ${input.query}`;
      
      const payload = {
          messages: [{ role: 'user' as const, text: opticalPrompt }],
          images: input.images.map(img => ({
              data: img.sourceBase64,
              mimeType: img.mimeType
          })),
          systemInstruction: context.systemInstruction,
          mode: 'optical'
      };
      
      const response = await context.provider.generateContent(payload);
      // Mark trace
      response.executionTrace.push({ step: 'OPTICAL_ANALYSIS_COMPLETED', status: 'SUCCESS' });
      return response;
  }
};

export const SarAnalysisTool: Tool = {
  name: 'sar_analysis',
  description: 'Specialist tool for analyzing SAR imagery (backscatter, bright/dark returns, texture, structure).',
  version: '1.0.0',
  supportedTasks: ['SAR_ANALYSIS', 'OPTICAL_SAR_ANALYSIS', 'BI_TEMPORAL_ANALYSIS'],
  supportedModalities: ['SAR'],
  isImplemented: true,
  async execute(input, context): Promise<AIProviderResponse> {
      const metadataContext = input.images.map(img => {
          let str = `Image Modality: ${img.modality}`;
          if (img.polarization && img.polarization !== 'UNKNOWN') str += `, Polarization: ${img.polarization}`;
          return str;
      }).join('\n');

      const sarPrompt = `You are analyzing Sentinel-1 SAR imagery, not RGB optical imagery.

Analyze the supplied SAR image using SAR-specific visual characteristics such as backscatter intensity, bright/dark regions, texture, spatial structure, smooth versus rough surfaces, and possible structural patterns.

Clearly distinguish:

OBSERVED EVIDENCE
from
INTERPRETATION.

Do not invent sensor metadata, polarization, coordinates, numerical measurements, object counts, or geographic locations.

If the image is insufficient to establish a conclusion, state INCONCLUSIVE or NEEDS_MORE_EVIDENCE.

METADATA:
${metadataContext}

Query context: ${input.query}`;
      
      const payload = {
          messages: [{ role: 'user' as const, text: sarPrompt }],
          images: input.images.map(img => ({
              data: img.sourceBase64,
              mimeType: img.mimeType
          })),
          systemInstruction: context.systemInstruction,
          mode: 'sar'
      };
      
      const response = await context.provider.generateContent(payload);
      response.executionTrace.push({ step: 'SAR_ANALYSIS_COMPLETED', status: 'SUCCESS' });
      return response;
  }
};

export const TemporalAnalysisTool: Tool = {
  name: 'temporal_analysis',
  description: 'Specialist tool for analyzing temporal change between BEFORE and AFTER images.',
  version: '1.0.0',
  supportedTasks: ['BI_TEMPORAL_ANALYSIS', 'CHANGE_VQA'],
  supportedModalities: ['OPTICAL', 'SAR'],
  isImplemented: true,
  async execute(input, context): Promise<AIProviderResponse> {
      const temporalPrompt = `You are a specialist in Bi-Temporal Remote Sensing and Change Detection.
Analyze the provided BEFORE (Image 1) and AFTER (Image 2) images.
Identify candidate changes. Distinguish between: CHANGE, NO_CONFIDENT_CHANGE, and INSUFFICIENT_EVIDENCE.
Consider confounders: cloud, shadow, illumination, seasonal variation, image registration, and sensor differences.
Do not automatically label every visual difference as physical change.
Query context: ${input.query}`;
      
      const payload = {
          messages: [{ role: 'user' as const, text: temporalPrompt }],
          images: input.images.map(img => ({
              data: img.sourceBase64,
              mimeType: img.mimeType
          })),
          systemInstruction: context.systemInstruction,
          mode: 'temporal'
      };
      
      const response = await context.provider.generateContent(payload);
      response.executionTrace.push({ step: 'TEMPORAL_ANALYSIS_COMPLETED', status: 'SUCCESS' });
      return response;
  }
};

export const CrossModalArbitratorTool: Tool = {
  name: 'cross_modal_arbitrator',
  description: 'Arbitrates between independent evidence streams (e.g., Optical vs SAR).',
  version: '1.0.0',
  supportedTasks: ['OPTICAL_SAR_ANALYSIS', 'BI_TEMPORAL_ANALYSIS'],
  supportedModalities: ['ALL'],
  isImplemented: true,
  async execute(input, context): Promise<AIProviderResponse> {
      const arbitrationPrompt = `You are the Cross-Modal Arbitration Engine.
You have received independent analyses from specialist modules.
Query: ${input.query}
Optical Analysis: ${JSON.stringify(input.opticalResult)}
SAR Analysis: ${JSON.stringify(input.sarResult)}

Determine: agreement, disagreement, complementary evidence, or insufficient evidence.
If modalities disagree, preserve the disagreement, explain it, and reduce confidence appropriately.
Do not silently choose one modality over another without explanation.
Output a final synthesized conclusion following the standard JSON schema.`;
      
      const payload = {
          messages: [{ role: 'user' as const, text: arbitrationPrompt }],
          images: [], // Arbitration operates on text/evidence
          systemInstruction: context.systemInstruction,
          mode: 'arbitration'
      };
      
      const response = await context.provider.generateContent(payload);
      response.executionTrace.push({ step: 'CROSS_MODAL_ARBITRATION_COMPLETED', status: 'SUCCESS' });
      return response;
  }
};

export const ConversationalFollowupTool: Tool = {
  name: 'conversational_followup',
  description: 'Handles follow-up conversational queries by relying on session context and existing evidence.',
  version: '1.0.0',
  supportedTasks: ['FOLLOW_UP'],
  supportedModalities: ['ALL'],
  isImplemented: true,
  async execute(input, context): Promise<AIProviderResponse> {
      const chatHistory = context.session?.messages.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n') || '';
      const previousEvidence = context.session?.evidenceHistory.slice(-2) || [];
      
      const followUpPrompt = `You are a conversational Remote Sensing Assistant.
The user is asking a follow-up question.
Use the previous conversation and evidence below to answer the user's query.

PREVIOUS CONVERSATION:
${chatHistory}

PREVIOUS EVIDENCE EXTRACTED BY SPECIALIST MODULES:
${JSON.stringify(previousEvidence)}

USER QUERY:
${input.query}

Determine if this question can be answered using existing evidence. If so, provide the answer.
If it requires completely new visual analysis that isn't covered in the previous evidence, state INSUFFICIENT EVIDENCE and explain why a new analysis is needed.`;
      
      const payload = {
          messages: [{ role: 'user' as const, text: followUpPrompt }],
          images: input.images.map(img => ({
              data: img.sourceBase64,
              mimeType: img.mimeType
          })),
          systemInstruction: context.systemInstruction,
          mode: 'follow_up',
          signal: context.signal,
          timeoutMs: context.timeoutMs
      };
      
      const response = await context.provider.generateContent(payload);
      response.executionTrace.push({ step: 'CONVERSATIONAL_RESPONSE_GENERATED', status: 'SUCCESS' });
      return response;
  }
};

globalRegistry.register(OpticalAnalysisTool);
globalRegistry.register(SarAnalysisTool);
globalRegistry.register(TemporalAnalysisTool);
globalRegistry.register(CrossModalArbitratorTool);
globalRegistry.register(ConversationalFollowupTool);
