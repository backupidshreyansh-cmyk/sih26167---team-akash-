# Local Development (Windows PC)

This document outlines how to take the exported ORBITAL EYE repository and run it locally on your Windows machine, specifically leveraging the NVIDIA RTX 4050 GPU on your Lenovo LOQ.

## 1. Export the Code
If you developed this in Google AI Studio, ensure your latest changes are pushed to GitHub or download the workspace as a ZIP file. Extract it to your preferred local folder on Windows.

## 2. Environment Setup
1. Download and install [Node.js](https://nodejs.org/) (v22+ recommended).
2. Open PowerShell or Terminal and navigate to the project root.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
   Add your Gemini API key if you plan to use `ONLINE` or `AUTO` modes.

## 3. Ollama Installation & VLM Setup
To execute the application completely offline without sending imagery to the cloud:
1. Download [Ollama for Windows](https://ollama.com/download/windows).
2. Run the installer. Ensure the Ollama tray icon is active.
3. In your terminal, pull the specified Vision-Language Model:
   ```bash
   ollama run qwen3-vl:4b-instruct
   ```
   *Note: This specific 4B parameter model requires ~4.5GB of VRAM, perfectly fitting within the 6GB limit of your RTX 4050.*

## 4. Running the Application
### Development Mode
To work on the code with live-reloading:
```bash
npm run dev
```

### Production Build
To test the optimized, compiled version:
```bash
npm run build
npm run start
```
The application will be accessible at `http://localhost:3000`.

## 5. Local Testing Validation
Once running locally, verify the following:
- The UI Header should display a green `Active Engine` indicating `Qwen3-VL Ready`.
- Turn off your PC's WiFi.
- Select `OFFLINE` mode.
- Upload an image and ask "What is this?". The local GPU should spin up and answer based on the local model inference.
