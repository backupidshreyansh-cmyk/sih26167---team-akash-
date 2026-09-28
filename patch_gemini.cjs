const fs = require('fs');
let content = fs.readFileSync('server/providers/GeminiProvider.ts', 'utf8');

const targetStr = `return {
      provider: "Gemini",
      model: actualModel,
      ...data,
      executionTrace: [...traceHeader, { step: "GEMINI_RESPONSE_RECEIVED", status: "SUCCESS" }, ...(data.executionTrace || [])]
    };`;

const replaceStr = `let tokenUsage;
    let cost;
    const usageMetadata = response.usageMetadata;
    
    if (usageMetadata) {
        const inputTokens = usageMetadata.promptTokenCount || 0;
        const outputTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || (inputTokens + outputTokens);
        const cachedTokens = usageMetadata.cachedContentTokenCount || 0;
        
        tokenUsage = {
            inputTokens,
            outputTokens,
            totalTokens,
            cachedTokens
        };
        
        const isPro = actualModel.includes('pro');
        
        // Accurate flash-lite pricing
        const actualCost = isPro ? 
            (inputTokens / 1000000) * 1.25 + (outputTokens / 1000000) * 5.00 :
            (inputTokens / 1000000) * 0.075 + (outputTokens / 1000000) * 0.30;
            
        // Baseline assumes no cross-modal routing and forcing a Pro model for all multimodal ops
        const baselineCost = (inputTokens / 1000000) * 1.25 + (outputTokens / 1000000) * 5.00;
        
        cost = {
            actualCost,
            baselineCost,
            savings: baselineCost - actualCost,
            savingsPercentage: baselineCost > 0 ? ((baselineCost - actualCost) / baselineCost) * 100 : 0
        };
    }

    return {
      provider: "Gemini",
      model: actualModel,
      ...data,
      tokenUsage,
      cost,
      executionTrace: [...traceHeader, { step: "GEMINI_RESPONSE_RECEIVED", status: "SUCCESS" }, ...(data.executionTrace || [])]
    };`;

if (!content.includes('usageMetadata')) {
    content = content.replace(targetStr, replaceStr);
    
    // Also fix actualModel mapping to respect orchestrator override
    content = content.replace(
        'model: actualModel,',
        'model: req.config?.model || actualModel,'
    );
    // Replace the request configuration
    content = content.replace(
        'const requestConfig: any = {',
        'actualModel = req.config?.model || actualModel;\n    const requestConfig: any = {'
    );
    
    fs.writeFileSync('server/providers/GeminiProvider.ts', content);
}
