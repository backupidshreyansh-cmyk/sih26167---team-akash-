# Architecture & Project Structure

## Overview
ORBITAL EYE is designed as a modular, full-stack TypeScript repository. 

By keeping the application logic strictly separated from the AI invocation layer, the architecture remains robust, testable, and highly portable.

## Directory Structure
```text
/
├── src/                      # Frontend Client (React)
│   ├── components/           # (Future) Reusable UI components
│   ├── services/             # Client-side API abstractions
│   │   └── chatService.ts    # Centralized fetching logic
│   ├── types/                # Shared TS interfaces
│   │   └── index.ts          # Common DTOs (Data Transfer Objects)
│   ├── specification.ts      # Core prompt boundaries
│   └── App.tsx               # Main React application
│
├── server/                   # Backend API (Express)
│   ├── providers/            # AI Integration Layer
│   │   ├── AIProvider.ts     # The universal interface contract
│   │   ├── GeminiProvider.ts # Concrete implementation for Google GenAI
│   │   └── LocalOllamaProvider.ts # Concrete implementation for Local VLM
│   ├── routes/               # Express routing logic
│   │   ├── chat.ts           # The core multimodal orchestration endpoint
│   │   └── health.ts         # Ping endpoints for local service discovery
│   └── server.ts             # Express application entrypoint
│
├── docs/                     # Project documentation
├── .env.example              # Environment variable templates
├── package.json              # NPM dependencies and scripts
└── tsconfig.json             # TypeScript compiler settings
```

## Key Architectural Decisions

1. **Backend-Heavy AI:** The frontend NEVER imports `@google/genai` or talks to Ollama directly. This guarantees API keys never leak into the browser bundle and eliminates CORS issues with local daemons.
2. **Provider Abstraction:** The `AIProvider` interface allows the orchestrator (`chat.ts`) to request complex multimodal analysis without knowing the underlying network protocol of the AI model.
3. **Single Build Artifact:** Using Vite and ESBuild, `npm run build` generates a completely self-contained `dist/` directory that can be deployed to Cloud Run or run on a local Windows machine effortlessly via `node dist/server.cjs`.
