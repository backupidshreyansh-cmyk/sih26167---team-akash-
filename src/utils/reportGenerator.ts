import { AgentResponse, UploadedImage } from '../types';

export function generateSihReport(
  query: string,
  response: AgentResponse,
  images: UploadedImage[],
  runId: string
): string {
  const timestamp = new Date().toISOString();
  
  const filesBlock = images.map((img, idx) => {
    const slot = img.slot ? img.slot.toUpperCase() : `SLOT ${idx + 1}`;
    const name = img.metadata?.fileName || img.file.name;
    const dims = img.metadata?.width && img.metadata?.height ? `${img.metadata.width}x${img.metadata.height} px` : 'Unspecified';
    const bands = img.metadata?.bandCount ? `${img.metadata.bandCount} Band(s)` : 'RGB';
    const crs = img.metadata?.crs || (img.metadata?.epsg ? `EPSG:${img.metadata.epsg}` : 'Unprojected Pixel Space');
    const pol = img.metadata?.polarization ? ` | Polarization: ${img.metadata.polarization}` : '';
    const bounds = img.metadata?.bounds ? `\n    Bounds: [${img.metadata.bounds.join(', ')}]` : '';

    return `  [${slot}] ${name}
    Dimensions: ${dims} | Bands: ${bands} | CRS: ${crs}${pol}${bounds}`;
  }).join('\n\n');

  const toolsExecuted = response.executionTrace
    .filter(t => t.step.includes('_COMPLETED') || t.step.includes('_SELECTED'))
    .map(t => t.step)
    .join(', ') || 'visual_vqa';

  const observations = response.evidence?.observations?.map((o: any) => `  * ${typeof o === 'string' ? o : o?.text || o}`).join('\n') || '  * None logged.';
  const interpretations = response.evidence?.interpretations?.map((i: any) => `  * ${typeof i === 'string' ? i : i?.text || i}`).join('\n') || '  * None logged.';
  const limitations = response.confidence?.limitations?.map(l => `  * ${l}`).join('\n') || '  * Standard remote sensing resolution constraints apply.';

  const groundingList = response.groundingBoxes && response.groundingBoxes.length > 0
    ? response.groundingBoxes.map(b => `  * ${b.label}: [ymin: ${Math.round(b.ymin)}, xmin: ${Math.round(b.xmin)}, ymax: ${Math.round(b.ymax)}, xmax: ${Math.round(b.xmax)}]`).join('\n')
    : '  * No bounding box coordinates generated for this query.';

  const traceLog = response.executionTrace.map(t => {
    const status = (t.status || 'INFO').padEnd(8);
    const step = t.step.padEnd(32);
    const details = t.details ? ` -> ${t.details}` : '';
    return `  [${status}] ${step}${details}`;
  }).join('\n');

  return `================================================================================
SATQUERY AI — OFFICIAL SIH-26167 REMOTE SENSING AUDIT REPORT
Indian Space Research Organisation (ISRO) Problem Statement 26167
================================================================================

MISSION METADATA
--------------------------------------------------------------------------------
Mission Run ID        : ${runId}
Generated At          : ${timestamp}
AI Provider & Engine  : ${response.provider || 'Gemini'} (${response.model || 'Flash'})
Task Classification   : ${response.taskClassification}
Decision Gate Status  : ${response.confidence?.level || 'EVALUATED'}

USER QUERY
--------------------------------------------------------------------------------
"${query}"

INPUT SATELLITE IMAGERY & SENSOR METADATA
--------------------------------------------------------------------------------
${filesBlock || '  No external images logged.'}

REMOTE SENSING WORKFLOW EXECUTION
--------------------------------------------------------------------------------
Workflow Mode         : ${response.taskClassification}
Tools Invoked         : ${toolsExecuted}
Token Telemetry       : Input: ${response.tokenUsage?.inputTokens ?? 'N/A'} | Output: ${response.tokenUsage?.outputTokens ?? 'N/A'} | Total: ${response.tokenUsage?.totalTokens ?? 'N/A'}

SYNTHESIZED ANSWER
--------------------------------------------------------------------------------
${response.answer}

EVIDENCE GRAPH
--------------------------------------------------------------------------------
[KEY OBSERVED EVIDENCE]
${observations}

[REMOTE SENSING INTERPRETATIONS]
${interpretations}

[VISUAL GROUNDING COORDINATES (0-1000 Normalized)]
${groundingList}

UNCERTAINTY & CONFIDENCE ASSESSMENT
--------------------------------------------------------------------------------
Confidence Rating     : ${response.confidence?.level}
Calibrated / Model    : ${response.confidence?.isModelEstimated ? 'Model Estimated Assessment' : 'Calibrated Assessment'}
Recommended Modality  : ${response.recommendedModality || 'Optical / SAR as applicable'}

[LIMITATIONS & ENVIRONMENTAL CONFOUNDERS]
${limitations}

AUDITABLE EXECUTION TRACE
--------------------------------------------------------------------------------
${traceLog}

================================================================================
End of SatQuery AI SIH-26167 Intelligence Report. Grounded in Visual Evidence.
================================================================================
`;
}
