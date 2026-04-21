import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { Pool } from "pg";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const dbUrl = process.env.DATABASE_URL ?? "";
  const isRemoteDb =
    dbUrl.length > 0 &&
    !dbUrl.includes("localhost") &&
    !dbUrl.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5,
    ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
  });
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";
  if (!process.env.SESSION_SECRET) {
    console.warn("[auth] SESSION_SECRET not set — using insecure default. Set it in .env for production.");
  }
  return session({
    secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.session && (req.session as any).userId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
