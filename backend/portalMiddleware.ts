import type { Request, Response, NextFunction } from "express";
import {
  resolvePortalFromRequest,
  type PortalId,
} from "@shared/portal";

declare global {
  namespace Express {
    interface Request {
      portal: PortalId;
    }
  }
}

function pathnameFromRequest(req: Request): string | undefined {
  try {
    const raw = req.originalUrl || req.url || "";
    const path = raw.split("?")[0] || "";
    if (path && path !== "/" && !path.startsWith("/api")) {
      return path;
    }
  } catch {
    /* ignore */
  }
  const referer = req.headers.referer || req.headers.referrer;
  if (typeof referer === "string" && referer) {
    try {
      return new URL(referer).pathname;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

/** Attach req.portal from X-Portal / ?portal= / path / PORTAL env */
export function portalMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const hostHeader = req.headers["x-forwarded-host"] || req.headers.host || "";
  const hostname = String(hostHeader).split(",")[0].trim();

  req.portal = resolvePortalFromRequest({
    queryPortal: req.query.portal,
    headerPortal: req.headers["x-portal"],
    pathname: pathnameFromRequest(req),
    hostname,
    envPortal: process.env.PORTAL,
  });

  next();
}
