import { NormalizedImage } from '../imagery/types.js';
import { TaskClassification } from '../schemas/responses.js';

export function classifyTask(query: string, images: NormalizedImage[], hasSessionContext = false): TaskClassification {
  const q = query.toLowerCase();
  
  if (images.length === 0) {
      if (hasSessionContext) {
          return 'FOLLOW_UP';
      }
      return 'UNSUPPORTED_QUERY';
  }

  // If there are no images attached to THIS specific request, but there is session context
  // Wait, if images.length === 0 and hasSessionContext is true, it returns FOLLOW_UP above.
  
  // If there ARE images attached, but the user is explicitly referring to past context
  if (hasSessionContext && (q.includes('what did you mean') || q.includes('why') || q.includes('expand on') || q.includes('tell me more') || q.includes('previous'))) {
      return 'FOLLOW_UP';
  }

  if (images.length === 2) {
      const isBeforeAfter = images.some(i => i.temporalRole === 'BEFORE') && images.some(i => i.temporalRole === 'AFTER');
      const isOpticalSar = images.some(i => i.modality === 'OPTICAL') && images.some(i => i.modality === 'SAR');
      
      if (isBeforeAfter || q.includes('change') || q.includes('difference') || q.includes('before') || q.includes('after') || q.includes('increase') || q.includes('decrease') || q.includes('temporal')) {
          return 'BI_TEMPORAL_ANALYSIS';
      }
      if (isOpticalSar || q.includes('sar') || q.includes('optical') || q.includes('radar') || q.includes('cross-modal') || q.includes('complementary')) {
          return 'OPTICAL_SAR_ANALYSIS';
      }
      return 'OPTICAL_SAR_ANALYSIS'; 
  }

  if (images.length === 1 && images[0].modality === 'SAR' && !q.includes('optical')) {
      return 'SAR_ANALYSIS';
  }

  if (q.includes('count') || q.includes('how many')) {
      return 'COUNTING';
  }

  if (q.includes('where is') || q.includes('locate') || q.includes('ground') || q.includes('bbox')) {
      return 'TEXT_GUIDED_GROUNDING';
  }

  if (q.includes('describe') || q.includes('what is happening') || q.includes('caption')) {
      return 'SCENE_DESCRIPTION';
  }

  if (q.includes('sar ') || q.includes('radar')) {
      return 'SAR_ANALYSIS';
  }
  
  if (q.includes('optical')) {
      return 'OPTICAL_ANALYSIS';
  }
  
  if (q.match(/\b(not|no|none)\b/)) {
      return 'NEGATIVE_QUERY';
  }

  return 'SINGLE_IMAGE_VQA';
}
