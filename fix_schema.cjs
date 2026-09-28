const fs = require('fs');
let content = fs.readFileSync('server/schemas/responses.ts', 'utf8');

content = content.replace(/  tokenUsage\?: \{[^}]+\};\n  cost\?: \{[^}]+\};\n/, '');

const newAgentResponse = `export interface AgentResponse {
  executionTrace: ExecutionTraceStep[];
  taskClassification: TaskClassification;
  answer: string;
  evidence: Evidence;
  confidence: ConfidenceAssessment;
  recommendedModality?: string;
  detectedModality?: string;
  polarization?: string;
  metadata?: any;
  groundingBoxes?: GroundingBox[];
  provider?: string;
  model?: string;
  modelRoute?: string[];
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedTokens?: number;
  };
  cost?: {
    actualCost: number;
    baselineCost: number;
    savings: number;
    savingsPercentage: number;
  };
}`;

content = content.replace(/export interface AgentResponse \{[\s\S]*?\}/, newAgentResponse);
fs.writeFileSync('server/schemas/responses.ts', content);
