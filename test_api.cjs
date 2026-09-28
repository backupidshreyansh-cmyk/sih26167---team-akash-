const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('RESPONSE:', data));
});

req.on('error', (e) => console.error('ERROR:', e.message));

req.write(JSON.stringify({
  messages: [{ role: 'user', text: 'What are the major spatial patterns visible in this Sentinel-1 SAR image, and what could they represent? Clearly distinguish observed SAR evidence from interpretation.' }],
  images: [{ data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', mimeType: 'image/png' }],
  sessionId: 'test_123',
  mode: 'optical',
  aiMode: 'online'
}));
req.end();
