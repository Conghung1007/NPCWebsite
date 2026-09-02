import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import {
  allowedCorsOrigins,
  resolveCookieDomain,
} from "@shared/origins";
import { isGoogleAuthConfigured } from "./googleAuth";

const app = express();

// Required behind Render / reverse proxies (secure cookies, correct IPs)
app.set("trust proxy", 1);

const cookieDomain = resolveCookieDomain();
if (cookieDomain) {
  log(`Session cookie domain: ${cookieDomain}`);
}

// JSON body limit: large enough for exam payloads, avoid unbounded 100MB default
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Credentialed CORS for portal subdomains (same app, shared cookie Domain)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedCorsOrigins().includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Portal, Authorization",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key-here",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
  }),
);

// Lightweight request logging — do not capture response bodies (CPU + PII risk)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
  });
  next();
});

(async () => {
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      publicAppUrl: process.env.PUBLIC_APP_URL || null,
      cookieDomain: cookieDomain || null,
      portals: ["group", "huongnghiep", "dichvu", "luyenthi"],
      external: { daoTao: "https://tnjs.vn" },
      features: {
        dashboard: true,
        siteSettings: true,
        pageAnalytics: true,
      },
    });
  });

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    log(`Error ${status}: ${message}`);
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0" }, () => {
    log(`API serving on port ${port}`);
    if (process.env.RESEND_API_KEY?.trim()) {
      const from =
        process.env.RESEND_FROM_EMAIL?.trim() || "TNJS <support@tnjs.vn>";
      log(`[Email] Resend configured — sender ${from}`);
    } else {
      log("[Email] RESEND_API_KEY not set — registration OTP disabled.");
    }
    if (isGoogleAuthConfigured()) {
      log("[Auth] Google Sign-In enabled");
    } else {
      log("[Auth] GOOGLE_CLIENT_ID not set — Google Sign-In disabled.");
    }
  });
})();
