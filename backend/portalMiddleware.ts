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

/** Attach req.portal from query / X-Portal / Host / PORTAL env */
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
    hostname,
    envPortal: process.env.PORTAL,
  });

  next();
}
