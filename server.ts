import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { handler as statsHandler } from "./api/stats.js";
import barangaysHandler from "./api/barangays.js";
import barangayIdHandler from "./api/barangays/[id].js";
import patientsHandler from "./api/patients.js";
import patientsDetailHandler from "./api/patients/detail.js";
import patientsBatchHandler from "./api/patients/batch.js";
import patientsDeleteFilteredHandler from "./api/patients/delete-filtered.js";
import patientsMergeAllHandler from "./api/patients/merge-all.js";
import auditHandler from "./api/audit.js";
import auditLogsHandler from "./api/audit_logs.js";
import exportCoverageHandler from "./api/export-coverage.js";

function createMockRes(res: any) {
  return {
    status: (code: number) => {
      res.status(code);
      return {
        json: (data: any) => res.json(data),
        send: (data: any) => res.send(data),
        end: () => res.end()
      };
    },
    json: (data: any) => res.json(data),
    send: (data: any) => res.send(data),
    setHeader: (name: string, value: string) => res.setHeader(name, value),
    end: () => res.end()
  } as any;
}

function createMockReq(req: any, params: any = {}) {
  return {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: { ...req.query, ...params },
    body: req.body,
    cookies: req.cookies,
  } as any;
}

async function startServer() {
  const app = express();
  
  // DEBUG: Intercept all requests immediately
  app.use((req, res, next) => {
    // Handle method override
    const overrideMethod = req.headers['x-http-method-override'];
    if (overrideMethod && typeof overrideMethod === 'string') {
      req.method = overrideMethod.toUpperCase();
    }

    console.log(`[Raw] ${req.method} ${req.url}`);
    res.setHeader('X-Debug-Raw', 'Active');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-HTTP-Method-Override');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  app.use(express.json()); // Add JSON body parsing middleware
  const PORT = 3000;

  // Global logging middleware
  app.use((req, res, next) => {
    console.log(`[Global] ${req.method} ${req.url}`);
    res.setHeader('X-Debug-Server', 'Active');
    next();
  });

  // Helper to wrap async handlers
  const wrap = (handler: any) => async (req: express.Request, res: express.Response) => {
    try {
      const mockReq = createMockReq(req, req.params);
      const mockRes = createMockRes(res);
      await handler(mockReq, mockRes);
    } catch (err: any) {
      console.error(`[Server Error] Handler failed:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal Server Error", message: err.message });
      }
    }
  };

  // API routes
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  app.get("/api/download-fuzzy-bantay", (req, res) => {
    const file = path.join(process.cwd(), 'public', 'fuzzy_bantay_duplicates.csv');
    res.download(file, 'fuzzy_bantay_duplicates.csv');
  });
  app.get("/api/download-fuzzy-narvacan", (req, res) => {
    const file = path.join(process.cwd(), 'public', 'fuzzy_narvacan_duplicates.csv');
    res.download(file, 'fuzzy_narvacan_duplicates.csv');
  });
  app.get("/api/download-fuzzy-sanjuan", (req, res) => {
    const file = path.join(process.cwd(), 'public', 'fuzzy_sanjuan_duplicates.csv');
    res.download(file, 'fuzzy_sanjuan_duplicates.csv');
  });
  app.get("/api/download-fuzzy-candon", (req, res) => {
    const file = path.join(process.cwd(), 'public', 'fuzzy_candon_duplicates.csv');
    res.download(file, 'fuzzy_candon_duplicates.csv');
  });
  app.get("/api/download-fuzzy-santacruz", (req, res) => {
    const file = path.join(process.cwd(), 'public', 'fuzzy_santacruz_duplicates.csv');
    res.download(file, 'fuzzy_santacruz_duplicates.csv');
  });
  app.get("/api/download-fuzzy-santalucia", (req, res) => {
    const file = path.join(process.cwd(), 'public', 'fuzzy_santalucia_duplicates.csv');
    res.download(file, 'fuzzy_santalucia_duplicates.csv');
  });
  app.get("/api/download-fuzzy-sanildefonso", (req, res) => {
    const file = path.join(process.cwd(), 'public', 'fuzzy_sanildefonso_duplicates.csv');
    res.download(file, 'fuzzy_sanildefonso_duplicates.csv');
  });
  app.get("/api/download-no-services", (req, res) => {
    const file = path.join(process.cwd(), 'public', 'patients_without_services.csv');
    res.download(file, 'patients_without_services.csv');
  });
  app.all("/api/stats", wrap(statsHandler));
  app.all("/api/export-coverage", wrap(exportCoverageHandler));
  app.all("/api/barangays", wrap(barangaysHandler));
  app.all("/api/audit", wrap(auditHandler));
  app.all("/api/audit_logs", wrap(auditLogsHandler));
  app.all("/api/patients/delete-filtered", wrap(patientsDeleteFilteredHandler));
  app.all("/api/patients/merge-all", wrap(patientsMergeAllHandler));

  app.all("/api/barangays/:id", wrap(barangayIdHandler));
  app.all("/api/patients/batch", wrap(patientsBatchHandler));

  app.all("/api/patients/:id", wrap(patientsDetailHandler));

  app.all("/api/patients", wrap(patientsHandler));

  // Catch-all for unhandled API routes
  app.use("/api", (req, res) => {
    console.log(`[Unhandled API] ${req.method} ${req.url}`);
    res.status(404).json({ error: "API route not found" });
  });

  // Error handler for API routes
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[API Error] ${req.method} ${req.url}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Creating Vite server in development mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicit SPA fallback for development to ensure routes like /embed work
    app.use(async (req, res, next) => {
      // Only handle HTML requests
      if (req.headers.accept?.includes("text/html")) {
        const url = req.originalUrl;
        try {
          let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          next(e);
        }
      } else {
        next();
      }
    });
  } else {
    console.log("Serving static files from dist in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Fallback for SPA
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Listening on 0.0.0.0:${PORT}`);
    console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[Server] App ready to handle requests`);
  });
}

console.log("[Server] Attempting to start server...");
startServer().catch((err) => {
  console.error("[Server] Fatal error during startup:", err);
  process.exit(1);
});
