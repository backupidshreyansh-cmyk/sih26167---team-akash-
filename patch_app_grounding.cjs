const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<h4 className="text-[10px] font-bold text-slate-500 mb-2">VISUAL EVIDENCE</h4>`;
const replace = `<h4 className="text-[10px] font-bold text-slate-500 mb-2 flex justify-between">
    <span>VISUAL EVIDENCE</span>
    <span className="text-emerald-500/70">SOURCE: MODEL ESTIMATED</span>
</h4>`;

content = content.replace(target, replace);
fs.writeFileSync('src/App.tsx', content);
