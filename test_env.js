import dotenv from 'dotenv';
dotenv.config();
console.log('GEMINI_MODEL:', process.env.GEMINI_MODEL, 'Length:', process.env.GEMINI_MODEL?.length);
