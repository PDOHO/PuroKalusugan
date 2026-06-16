import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const _dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

import { handler as statsHandler } from "./server_api/stats.ts";
import barangaysHandler from "./server_api/barangays.ts";
import barangayIdHandler from "./server_api/barangays_id.ts";
import patientsHandler from "./server_api/patients.ts";
import patientsDetailHandler from "./server_api/patients_detail.ts";
import patientsBatchHandler from "./server_api/patients_batch.ts";
import patientsDeleteFilteredHandler from "./server_api/patients_delete_filtered.ts";
import patientsMergeAllHandler from "./server_api/patients_merge_all.ts";
import auditHandler from "./server_api/audit.ts";
import auditLogsHandler from "./server_api/audit_logs.ts";
import exportCoverageHandler from "./server_api/export-coverage.ts";

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
          let template = fs.readFileSync(path.resolve(_dirname, "index.html"), "utf-8");
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
