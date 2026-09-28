const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('MetadataPanel')) {
    content = content.replace(
        "import { EvidenceCard, ModelRoutingPanel, FalsifiabilityPanel }",
        "import { EvidenceCard, ModelRoutingPanel, FalsifiabilityPanel, MetadataPanel }"
    );
    
    content = content.replace(
        "<EvidenceCard response={message.agentResponse} />",
        "<MetadataPanel response={message.agentResponse} />\n                        <EvidenceCard response={message.agentResponse} />"
    );
}

fs.writeFileSync('src/App.tsx', content);
