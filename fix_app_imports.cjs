const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('import { EvidenceCard')) {
    content = `import { EvidenceCard, ModelRoutingPanel, FalsifiabilityPanel } from './components/JudgePanels';\n` + content;
}

if (!content.includes('import { SystemSelfTest')) {
    content = `import { SystemSelfTest } from './components/SystemSelfTest';\n` + content;
}

fs.writeFileSync('src/App.tsx', content);
