import { Jimp } from 'jimp';
async function test() {
  const img = new Jimp({ width: 100, height: 100, data: Buffer.alloc(100*100*4) });
  img.resize({ w: 50, h: 50 });
  console.log(img.bitmap.width);
}
test();
