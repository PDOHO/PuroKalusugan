import express from "express";

import { handler as statsHandler } from "../server_api/stats.ts";
import barangaysHandler from "../server_api/barangays.ts";
import barangayIdHandler from "../server_api/barangays_id.ts";
import patientsHandler from "../server_api/patients.ts";
import patientsDetailHandler from "../server_api/patients_detail.ts";
import patientsBatchHandler from "../server_api/patients_batch.ts";
import patientsDeleteFilteredHandler from "../server_api/patients_delete_filtered.ts";
import patientsMergeAllHandler from "../server_api/patients_merge_all.ts";
import auditHandler from "../server_api/audit.ts";
import auditLogsHandler from "../server_api/audit_logs.ts";
import exportCoverageHandler from "../server_api/export-coverage.ts";
import cronWarmHandler from "../server_api/cron-warm.ts";

const app = express();
app.use(express.json());

// Helpers to wrap handlers for Vercel
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
app.all("/api/cron-warm", wrap(cronWarmHandler));

// Export as Vercel serverless function
app.all("*", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

export default app;
