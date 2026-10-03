import { NormalizedImage } from '../imagery/types.js';
import { 
  AgentResponse, 
  ExecutionTraceStep, 
  ConfidenceAssessment, 
  Evidence, 
  TaskClassification,
  GroundingBox
} from '../schemas/responses.js';
import { classifyTask } from './taskClassifier.js';
import { AIProvider } from '../providers/AIProvider.js';
import { SessionState } from '../session/sessionManager.js';
import { SelfQuestioningEngine } from './selfQuestioningEngine.js';
import { globalRegistry } from '../tools/registry.js';
import { EOIntelligenceService } from '../analysis/eoIntelligenceService.js';
import { DeterministicEngine } from '../analysis/deterministicEngine.js';
import { RemoteSensingEvidenceEngine } from '../evidence/RemoteSensingEvidenceEngine.js';

export class Orchestrator {
    private provider: AIProvider;
    private systemInstruction: string;
    private session?: SessionState;
    private signal?: AbortSignal;
    private timeoutMs?: number;
    
    constructor(provider: AIProvider, systemInstruction: string, session?: SessionState, signal?: AbortSignal, timeoutMs?: number) {
        this.provider = provider;
        this.systemInstruction = systemInstruction;
        this.session = session;
        this.signal = signal;
        this.timeoutMs = timeoutMs;
    }

    public async execute(query: string, images: NormalizedImage[]): Promise<AgentResponse> {
        const trace: ExecutionTraceStep[] = [];
        const startTime = Date.now();

        // 1. INPUT VALIDATION
        trace.push({ step: 'INPUT_RECEIVED', status: 'SUCCESS', details: `${images.length} images received.` });

        // 2. TASK CLASSIFICATION
        const hasSessionHistory = !!(this.session && this.session.messages.length > 0);
        const task = classifyTask(query, images, hasSessionHistory);
        trace.push({ step: 'TASK_CLASSIFIED', status: 'SUCCESS', details: `Task classified as ${task}` });

        // PS 26227 CORE WORKFLOW ROUTING
        if (task === 'SEMANTIC_RETRIEVAL') {
            return await EOIntelligenceService.executeSemanticRetrieval(query, trace);
        }

        if (task === 'SIMILAR_SITE_DISCOVERY') {
            return await EOIntelligenceService.executeSimilarSiteDiscovery(query, images, trace);
        }

        if (task === 'METADATA_PROVENANCE') {
            return EOIntelligenceService.executeMetadataProvenance(images, trace);
        }

        if (task === 'ANALYST_REVIEW') {
            return await EOIntelligenceService.executeAnalystReview(query, trace);
        }

        // Single image with temporal change question: honest baseline abstention
        if ((task === 'CHANGE_VERIFICATION' || task === 'MULTITEMPORAL_CHANGE' || task === 'FALSE_ALARM_ASSESSMENT') && images.length === 1) {
            const metrics = await DeterministicEngine.analyzeImage(images[0]);
            let opticalEv;
            if (images[0].modality !== 'SAR') {
                opticalEv = await RemoteSensingEvidenceEngine.analyzeOpticalEvidence(images[0]);
            }
            return EOIntelligenceService.executeSingleObservationTemporalAbstention(query, images[0], metrics, opticalEv, trace);
        }

        // Single image scene interpretation: if no provider is present, direct Earth observation interpretation
        if (task === 'SCENE_INTERPRETATION' && images.length === 1 && !this.provider) {
            const metrics = await DeterministicEngine.analyzeImage(images[0]);
            const opticalEv = images[0].modality !== 'SAR' ? await RemoteSensingEvidenceEngine.analyzeOpticalEvidence(images[0]) : undefined;
            const sarEv = images[0].modality === 'SAR' ? await RemoteSensingEvidenceEngine.analyzeSAREvidence(images[0]) : undefined;
            return EOIntelligenceService.executeSceneInterpretation(query, images[0], metrics, opticalEv, sarEv, trace);
        }

        // Multi-temporal false-alarm assessment or bi-temporal change with 2 observations
        if ((task === 'FALSE_ALARM_ASSESSMENT' || task === 'MULTITEMPORAL_CHANGE' || task === 'CHANGE_VERIFICATION' || task === 'BI_TEMPORAL_ANALYSIS') && images.length === 2) {
            const tempEv = await RemoteSensingEvidenceEngine.computeChange(images[0], images[1]);
            return EOIntelligenceService.executeMultiTemporalAnalysis(query, images, tempEv, trace);
        }

        // 3. METADATA & MODALITY
        const metadataCount = images.filter(i => i.geospatialMetadata !== null).length;
        if (metadataCount > 0) {
            trace.push({ step: 'METADATA_EXTRACTED', status: 'INFO', details: `Found geospatial metadata in ${metadataCount} images.` });
        } else if (images.length > 0) {
            trace.push({ step: 'NO_GEOSPATIAL_METADATA', status: 'WARNING', details: `No authoritative EPSG/CRS found. Fallback to visual interpretation only.` });
        }

        // 4. UNSUPPORTED QUERY HANDLING
        if (task === 'UNSUPPORTED_QUERY') {
            return this.buildUnsupportedResponse(trace, task);
        }

        // If single image and task implies modality, update it
        if (images.length === 1 && images[0]?.modality === 'UNKNOWN') {
            if (task === 'SAR_ANALYSIS') {
                images[0].modality = 'SAR';
            } else if (task === 'OPTICAL_ANALYSIS') {
                images[0].modality = 'OPTICAL';
            }
        }

        // Trace workflow entry
        if (task === 'OPTICAL_SAR_ANALYSIS') {
            trace.push({ step: 'WORKFLOW_STARTED', status: 'INFO', details: 'OPTICAL + SAR COMPLEMENTARY ANALYSIS' });
        } else if (task === 'BI_TEMPORAL_ANALYSIS') {
            trace.push({ step: 'WORKFLOW_STARTED', status: 'INFO', details: 'BI-TEMPORAL CHANGE ANALYSIS' });
        } else if (task === 'FOLLOW_UP') {
            trace.push({ step: 'WORKFLOW_STARTED', status: 'INFO', details: 'CONVERSATIONAL FOLLOW-UP' });
        } else {
            trace.push({ step: 'WORKFLOW_STARTED', status: 'INFO', details: 'SINGLE IMAGE ANALYSIS' });
            if (task === 'SAR_ANALYSIS') {
                trace.push({ step: 'SAR_ANALYSIS_SELECTED', status: 'SUCCESS' });
            } else if (task === 'OPTICAL_ANALYSIS') {
                trace.push({ step: 'OPTICAL_ANALYSIS_SELECTED', status: 'SUCCESS' });
            } else if (task === 'TEXT_GUIDED_GROUNDING' || task === 'SPATIAL_REASONING' || task === 'COUNTING') {
                trace.push({ step: 'SPATIAL_REASONING_SELECTED', status: 'SUCCESS' });
            }
        }

        // Handle pure conversational follow-up if no images were provided
        if (task === 'FOLLOW_UP' && images.length === 0) {
            try {
                const followUpTool = globalRegistry.get('conversational_followup');
                if (followUpTool) {
                    const toolContext = {
                        provider: this.provider,
                        systemInstruction: this.systemInstruction,
                        session: this.session,
                        signal: this.signal,
                        timeoutMs: this.timeoutMs
                    };
                    const res = await followUpTool.execute({ query, images }, toolContext);
                    return {
                        executionTrace: [...trace, ...res.executionTrace],
                        taskClassification: task,
                        answer: res.answer,
                        evidence: res.evidence || { observations: [], interpretations: [] },
                        confidence: res.confidence || { level: 'MEDIUM', limitations: [], isModelEstimated: true },
                        recommendedModality: res.recommendedModality || 'UNKNOWN',
                        provider: res.provider,
                        model: res.model,
                        tokenUsage: res.tokenUsage,
                        cost: res.cost
                    };
                }
            } catch (err: any) {
                return this.buildErrorResponse(trace, task, err.message);
            }
        }

        // 5. EXECUTE 5-STAGE SELF-QUESTIONING ENGINE
        const engine = new SelfQuestioningEngine(
            this.provider,
            this.systemInstruction,
            this.signal,
            this.timeoutMs
        );

        try {
            const engineResult = await engine.analyze(query, images, task, hasSessionHistory);
            
            // Append engine trace to orchestrator trace
            trace.push(...engineResult.trace);

            // Add backward-compatible trace marks for test assertions
            if (task === 'SAR_ANALYSIS') {
                trace.push({ step: 'SAR_ANALYSIS_COMPLETED', status: 'SUCCESS' });
            } else if (task === 'OPTICAL_ANALYSIS') {
                trace.push({ step: 'OPTICAL_ANALYSIS_COMPLETED', status: 'SUCCESS' });
            } else if (task === 'SPATIAL_REASONING' || task === 'TEXT_GUIDED_GROUNDING') {
                trace.push({ step: 'SPATIAL_REASONING_COMPLETED', status: 'SUCCESS' });
            }

            trace.push({ step: 'EVIDENCE_ARBITRATION', status: 'SUCCESS' });
            trace.push({ step: 'COMPLETED', status: 'SUCCESS', durationMs: Date.now() - startTime });

            const contract = engineResult.contract;
            
            const evidence: Evidence = {
                observations: contract.observations,
                interpretations: contract.supportingEvidence,
                supportingEvidence: contract.supportingEvidence,
                contradictingEvidence: contract.contradictingEvidence,
                alternativeExplanations: contract.alternativeExplanations,
                confoundersChecked: contract.confoundersChecked
            };

            const confidence: ConfidenceAssessment = {
                level: (contract.finalDecision === 'VERIFIED' ? (contract.modelConfidence === 'HIGH' ? 'VERIFIED' : 'HIGH') :
                       contract.finalDecision === 'EVIDENCE_CONFLICT' ? 'CONFLICTING EVIDENCE' :
                       contract.finalDecision === 'NEEDS_MORE_EVIDENCE' ? 'NEEDS_MORE_EVIDENCE' :
                       'INCONCLUSIVE') as any,
                limitations: contract.limitations,
                isModelEstimated: true,
                evidenceSufficiency: contract.evidenceSufficiency,
                finalDecision: contract.finalDecision
            };

            return {
                executionTrace: trace,
                taskClassification: task,
                answer: engineResult.formattedAnswer,
                evidence,
                confidence,
                recommendedModality: engineResult.recommendedModality,
                detectedModality: images.length > 0 ? images.map(img => img.modality).join(' / ') : undefined,
                polarization: images.length > 0 ? images.map(img => img.polarization || 'UNKNOWN').join(' / ') : undefined,
                metadata: images.length > 0 ? images.map(img => img.geospatialMetadata) : undefined,
                groundingBoxes: engineResult.groundingBoxes,
                provider: this.provider.constructor.name.replace('Provider', ''),
                model: engineResult.audit.modelsUsed[0] || 'RemoteSensingModel',
                tokenUsage: {
                    inputTokens: engineResult.budget.inputTokens,
                    outputTokens: engineResult.budget.outputTokens,
                    totalTokens: engineResult.budget.totalTokens,
                    cachedTokens: engineResult.budget.cachedTokens
                },
                cost: {
                    actualCost: engineResult.budget.actualCost,
                    baselineCost: engineResult.budget.baselineCost,
                    savings: engineResult.budget.savings,
                    savingsPercentage: engineResult.budget.savingsPercentage
                },
                contract: engineResult.contract,
                audit: engineResult.audit,
                budget: engineResult.budget,
                evidencePlan: engineResult.evidencePlan,
                rasterValidations: engineResult.rasterValidations,
                opticalEvidence: engineResult.opticalEvidence,
                sarEvidence: engineResult.sarEvidence,
                temporalEvidence: engineResult.temporalEvidence,
                crossModalEvidence: engineResult.crossModalEvidence,
                groundedEvidenceRegions: engineResult.groundedEvidenceRegions,
                evidenceGraph: engineResult.evidenceGraph,
                dataQuality: engineResult.dataQuality,
                measurementQuality: engineResult.measurementQuality
            };

        } catch (e: any) {
            trace.push({ step: 'TOOL_EXECUTION_ERROR', status: 'WARNING', details: e.message });
            if (images.length === 1) {
                const metrics = await DeterministicEngine.analyzeImage(images[0]);
                const opticalEv = images[0].modality !== 'SAR' ? await RemoteSensingEvidenceEngine.analyzeOpticalEvidence(images[0]) : undefined;
                const sarEv = images[0].modality === 'SAR' ? await RemoteSensingEvidenceEngine.analyzeSAREvidence(images[0]) : undefined;
                return EOIntelligenceService.executeSceneInterpretation(query, images[0], metrics, opticalEv, sarEv, trace);
            }
            return this.buildErrorResponse(trace, task, e.message);
        }
    }

    private buildUnsupportedResponse(trace: ExecutionTraceStep[], task: TaskClassification): AgentResponse {
        return {
            executionTrace: trace,
            taskClassification: task,
            answer: `ANSWER\nInsufficient input or unsupported query format.\n\nEVIDENCE\n• No valid imagery supplied or query unrecognized.\n\nVERIFICATION\n• Input validation gate rejected payload.\n\nLIMITATIONS\n• Image file or query missing.\n\nDECISION\nINVALID INPUT`,
            evidence: { observations: [], interpretations: [] },
            confidence: { level: 'INSUFFICIENT EVIDENCE', limitations: ['No valid images provided or query unrecognized.'], isModelEstimated: false }
        };
    }

    private buildErrorResponse(trace: ExecutionTraceStep[], task: TaskClassification, error: string): AgentResponse {
        return {
            executionTrace: trace,
            taskClassification: task,
            answer: `ANSWER\nAnalysis could not be safely completed: ${error}\n\nEVIDENCE\n• Analysis pipeline halted before evidence could be verified.\n\nVERIFICATION\n• Pipeline caught execution exception.\n\nLIMITATIONS\n• Technical failure: ${error}\n\nDECISION\nINCONCLUSIVE`,
            evidence: { observations: [], interpretations: [] },
            confidence: { level: 'INSUFFICIENT EVIDENCE', limitations: [error], isModelEstimated: false }
        };
    }
}
