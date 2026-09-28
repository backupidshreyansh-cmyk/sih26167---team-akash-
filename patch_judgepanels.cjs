const fs = require('fs');
let content = fs.readFileSync('src/components/JudgePanels.tsx', 'utf8');

// Use regex to completely replace ModelRoutingPanel to avoid syntax confusion
content = content.replace(/export function ModelRoutingPanel[\s\S]*?export function FalsifiabilityPanel/, 
`export function ModelRoutingPanel({ response }: { response: AgentResponse }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden mt-2">
            <button 
                onClick={() => setExpanded(!expanded)} 
                className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-indigo-400">⚡</span>
                    <span className="text-xs font-bold text-slate-200">MODEL ROUTING DECISION</span>
                </div>
                {expanded ? <span className="text-slate-500">▼</span> : <span className="text-slate-500">▶</span>}
            </button>
            {expanded && (
                <div className="p-4 text-xs text-slate-300 space-y-3">
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 block mb-1">ROUTING STRATEGY</span>
                        <p>Cheapest sufficient model selected based on task complexity ({response.taskClassification}).</p>
                    </div>

                    {response.modelRoute && response.modelRoute.length > 1 && (
                        <div className="bg-slate-950 p-2 rounded border border-red-900/30 text-red-200">
                            <span className="text-[10px] font-bold text-red-500 block mb-1">ESCALATION TRIGGERED</span>
                            <p>Initial model failed quality gates. Escalatated through: {response.modelRoute.join(' → ')}</p>
                        </div>
                    )}

                    <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-slate-500 block">FINAL MODEL</span>
                            <span className="text-indigo-300 font-semibold">{response.model}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-500 block">AVOIDED</span>
                            <span className="text-slate-400">Unnecessary calls</span>
                        </div>
                    </div>

                    {response.tokenUsage && (
                        <div className="bg-slate-950 p-3 rounded border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-widest">Token Optimization Telemetry</span>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-slate-500">Input:</span> {response.tokenUsage.inputTokens.toLocaleString()}</div>
                                <div><span className="text-slate-500">Output:</span> {response.tokenUsage.outputTokens.toLocaleString()}</div>
                                <div><span className="text-slate-500">Total:</span> {response.tokenUsage.totalTokens.toLocaleString()}</div>
                                {response.tokenUsage.cachedTokens !== undefined && (
                                    <div><span className="text-slate-500">Cached:</span> {response.tokenUsage.cachedTokens.toLocaleString()}</div>
                                )}
                            </div>
                            {response.cost && (
                                <div className="mt-2 pt-2 border-t border-slate-800/50 flex justify-between text-[10px]">
                                    <span className="text-slate-500">Estimated Cost: ${"$"}{response.cost.actualCost.toFixed(4)}</span>
                                    <span className="text-emerald-400 font-bold">ESTIMATED SAVED: ${"$"}{(response.cost.baselineCost - response.cost.actualCost).toFixed(4)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function FalsifiabilityPanel`);
fs.writeFileSync('src/components/JudgePanels.tsx', content);
