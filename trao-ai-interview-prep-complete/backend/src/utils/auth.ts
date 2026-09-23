import jwt from "jsonwebtoken";
import { config } from "../config";
import { Request, Response, NextFunction } from "express";

export const COOKIE_NAME = "trao_session";

export function signUser(userId: string) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "7d" });
}

export function setSession(res: Response, userId: string) {
  res.cookie(COOKIE_NAME, signUser(userId), {
    httpOnly: true,
    sameSite: config.production ? "none" : "lax",
    secure: config.production,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: config.production ? "none" : "lax",
    secure: config.production
  });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Login required" } });
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    (req as any).userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: { code: "INVALID_SESSION", message: "Session expired or invalid" } });
  }
}
