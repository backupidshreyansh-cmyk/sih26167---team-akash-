const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// We need to add a SelfTestButton component and import it
if (!content.includes('SystemSelfTest')) {
    content = content.replace(
        "import { EvidenceCard, ModelRoutingPanel, FalsifiabilityPanel } from './components/JudgePanels';",
        "import { EvidenceCard, ModelRoutingPanel, FalsifiabilityPanel } from './components/JudgePanels';\nimport { SystemSelfTest } from './components/SystemSelfTest';"
    );
}

// Add the button near the "Analysis Mode" select or at the top header
const targetStr = '<h1 className="text-xl font-bold text-slate-100 uppercase tracking-widest flex items-center gap-3">';
const replacement = `
            <div className="flex items-center gap-4">
              <SystemSelfTest />
            </div>
            <h1 className="text-xl font-bold text-slate-100 uppercase tracking-widest flex items-center gap-3">
`;

if (!content.includes('<SystemSelfTest />')) {
    content = content.replace(targetStr, replacement);
}

fs.writeFileSync('src/App.tsx', content);
