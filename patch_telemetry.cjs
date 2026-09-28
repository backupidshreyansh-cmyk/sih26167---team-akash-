const fs = require('fs');
let content = fs.readFileSync('src/components/JudgePanels.tsx', 'utf8');

const targetStr = `<div className="text-right">
                            <span className="text-[10px] font-bold text-slate-500 block">AVOIDED</span>
                            <span className="text-slate-400">Unnecessary calls</span>
                        </div>`;

const replaceStr = `<div className="text-right">
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
                    )}`;

if (!content.includes('Token Optimization Telemetry')) {
    content = content.replace(targetStr, replaceStr);
    fs.writeFileSync('src/components/JudgePanels.tsx', content);
}
