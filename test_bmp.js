import { Jimp } from 'jimp';
async function test() {
  const img = new Jimp({ width: 2, height: 2, data: Buffer.from([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,0,255]) });
  const b64 = await img.getBase64('image/png');
  console.log('Base64:', b64);
}
test();
