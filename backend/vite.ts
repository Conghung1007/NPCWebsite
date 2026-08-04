import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/** In production, serve the built frontend from ../frontend/dist */
export function serveStatic(app: Express) {
  // Prefer cwd (repo root on Railway); fall back for tsx running from backend/
  const candidates = [
    path.resolve(process.cwd(), "frontend", "dist"),
    path.resolve(import.meta.dirname, "..", "frontend", "dist"),
    path.resolve(import.meta.dirname, "..", "..", "frontend", "dist"),
  ];
  const distPath = candidates.find((p) => fs.existsSync(p));

  if (!distPath) {
    throw new Error(
      `Could not find the frontend build (tried: ${candidates.join(", ")}). Run "npm run build" first.`,
    );
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

/** Dev mode no longer embeds Vite — run frontend separately on port 5173 */
export async function setupVite(_app: Express, _server: Server) {
  log("API-only mode. Start frontend with: npm run dev --workspace=frontend");
}
