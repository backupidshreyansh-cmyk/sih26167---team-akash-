const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// We need to import EvidenceCard, ModelRoutingPanel, FalsifiabilityPanel from './components/JudgePanels.tsx'
if (!content.includes('JudgePanels')) {
    content = content.replace(
        "import { Cpu, Satellite, Image as ImageIcon, FileDown, ShieldAlert, Send, Upload, X, AlertCircle } from 'lucide-react';",
        "import { Cpu, Satellite, Image as ImageIcon, FileDown, ShieldAlert, Send, Upload, X, AlertCircle } from 'lucide-react';\nimport { EvidenceCard, ModelRoutingPanel, FalsifiabilityPanel } from './components/JudgePanels';\n"
    );
}

const targetStr = '<ExecutionTrace trace={message.agentResponse.executionTrace} />';

const replacement = `
                        <EvidenceCard response={message.agentResponse} />
                        <ModelRoutingPanel response={message.agentResponse} />
                        <FalsifiabilityPanel response={message.agentResponse} />
                        <ExecutionTrace trace={message.agentResponse.executionTrace} />
`;

if (!content.includes('<EvidenceCard response={message.agentResponse} />')) {
    content = content.replace(targetStr, replacement);
}

fs.writeFileSync('src/App.tsx', content);
