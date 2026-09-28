import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { AIProvider, AIProviderRequest } from "./providers/AIProvider.js";
import { GeminiProvider } from "./providers/GeminiProvider.js";
import { LocalOllamaProvider } from "./providers/LocalOllamaProvider.js";
import { chatRouter } from "./routes/chat.js";
import { healthRouter } from "./routes/health.js";
import { testRouter } from "./routes/test.js";
import { eoRouter } from "./routes/eo.js";
import "./tools/eoTools.js";

async function startServer() {
  const app = express();
  const PORT = 3000; // Hardcoded to 3000 as per environment constraints

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Routes
  app.use("/api/health", healthRouter);
  app.use("/api/ollama/health", healthRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/system", testRouter);
  app.use("/api/eo", eoRouter);

  // API Error handler to ensure JSON responses for payload too large or parsing errors
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Payload Too Large: The uploaded images are too big. Please use smaller images.' });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Bad Request: Invalid JSON payload.' });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
