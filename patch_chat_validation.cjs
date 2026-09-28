const fs = require('fs');
let content = fs.readFileSync('server/routes/chat.ts', 'utf8');

const targetStr = `const normalizedImages = await Promise.all(
        (images || []).map((img: any, idx: number) => extractMetadata(img.data, img.mimeType, idx))
    );`;
const replacement = `
    const normalizedImages = [];
    for (let i = 0; i < (images || []).length; i++) {
        const img = images[i];
        if (!img.data || typeof img.data !== 'string') {
             throw new Error("Invalid image data provided. Must be base64 string.");
        }
        if (img.data.length > 50 * 1024 * 1024) {
             throw new Error("Image size exceeds 50MB limit.");
        }
        try {
            const normalized = await extractMetadata(img.data, img.mimeType, i);
            normalizedImages.push(normalized);
        } catch (e: any) {
            throw new Error(\`Failed to parse image \${i+1}: \${e.message}\`);
        }
    }
`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('server/routes/chat.ts', content);
