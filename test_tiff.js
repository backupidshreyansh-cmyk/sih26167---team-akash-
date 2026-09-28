import fs from 'fs';
import { Jimp } from 'jimp';

async function test() {
  try {
     // I don't have a tiff to test, let's just write the skeleton
     console.log('Jimp version:', Jimp);
  } catch (e) {
     console.error(e);
  }
}
test();
