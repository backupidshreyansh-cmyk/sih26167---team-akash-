const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `placeholder="Ask a question about the image(s)... e.g., 'Are there any buildings in this area?'"`;

const judgeQueries = `
<div className="absolute -top-8 left-0 right-0 flex gap-2 overflow-x-auto pb-2 scrollbar-hide opacity-70 hover:opacity-100 transition-opacity">
    {[
        "Describe this satellite scene and identify the major land-cover features.",
        "Is there evidence of built-up expansion between these two observations?",
        "Compare the optical and SAR observations and explain what each sensor contributes.",
        "What evidence supports your answer?",
        "Does the optical evidence agree with the SAR evidence?",
        "What would make the system mark this result inconclusive?"
    ].map((q, i) => (
        <button 
            key={i} 
            type="button" 
            onClick={() => setInputText(q)}
            className="shrink-0 text-[10px] bg-slate-800 text-slate-300 hover:bg-indigo-900/50 hover:text-indigo-200 px-2 py-1 rounded whitespace-nowrap border border-slate-700"
        >
            {q}
        </button>
    ))}
</div>
`;

if (!content.includes('Describe this satellite scene')) {
    // Inject above the input box. Find the textarea container.
    const searchStr = `<div className="relative">`;
    const replaceStr = `<div className="relative">\n${judgeQueries}`;
    content = content.replace(searchStr, replaceStr);
}

fs.writeFileSync('src/App.tsx', content);
