const fs = require('fs');
let content = fs.readFileSync('server/agent/orchestrator.ts', 'utf8');

const targetStr = `return {
            executionTrace: trace,
            taskClassification: task,
            answer: answer,
            evidence: finalEvidence,
            confidence: finalConfidence,
            recommendedModality: modelResponse.recommendedModality || 'UNKNOWN',
            detectedModality: images.length > 0 ? images.map(img => img.modality).join(' / ') : undefined,
            polarization: images.length > 0 ? images.map(img => img.polarization || 'UNKNOWN').join(' / ') : undefined,
            metadata: images.length > 0 ? images.map(img => img.geospatialMetadata) : undefined,
            provider: modelResponse.provider,
            model: modelResponse.model,
            groundingBoxes: modelResponse.groundingBoxes
        };`;

const replaceStr = `
        // Pass through token telemetry if available
        let finalTokenUsage = modelResponse.tokenUsage;
        let finalCost = modelResponse.cost;
        
        return {
            executionTrace: trace,
            taskClassification: task,
            answer: answer,
            evidence: finalEvidence,
            confidence: finalConfidence,
            recommendedModality: modelResponse.recommendedModality || 'UNKNOWN',
            detectedModality: images.length > 0 ? images.map(img => img.modality).join(' / ') : undefined,
            polarization: images.length > 0 ? images.map(img => img.polarization || 'UNKNOWN').join(' / ') : undefined,
            metadata: images.length > 0 ? images.map(img => img.geospatialMetadata) : undefined,
            provider: modelResponse.provider,
            model: modelResponse.model,
            groundingBoxes: modelResponse.groundingBoxes,
            tokenUsage: finalTokenUsage,
            cost: finalCost
        };`;

if (!content.includes('finalTokenUsage')) {
    content = content.replace(targetStr, replaceStr);
    fs.writeFileSync('server/agent/orchestrator.ts', content);
}
