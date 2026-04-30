import jwt from "jsonwebtoken";

/**
 * Shared JWT Authentication Middleware
 * 
 * Usage in other services:
 * 
 * import { authMiddleware, requireRole } from "../shared/auth-middleware.js";
 * 
 * app.get("/api/protected", authMiddleware, (req, res) => {
 *   // req.auth = { accountId, role, userId, driverId }
 * });
 * 
 * app.post("/api/driver-only", authMiddleware, requireRole("DRIVER"), (req, res) => {
 *   // Only DRIVER role can access
 * });
 */

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_ISSUER = "taxi-auth-service";
const JWT_AUDIENCE = "taxi-platform";

/**
 * Middleware to verify JWT and extract auth data
 */
export function authMiddleware(req, res, next) {
  try {
    // Support both header and query (for SSE)
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token;

    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    req.auth = {
      accountId: decoded.sub,
      role: decoded.role,
      userId: decoded.userId || null,
      driverId: decoded.driverId || null,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Middleware to require specific role(s)
 * Usage: requireRole("DRIVER") or requireRole(["USER", "ADMIN"])
 */
export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.auth || !req.auth.role) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: `Forbidden. Required role: ${roles.join(" or ")}` });
    }

    next();
  };
}

/**
 * Optional middleware: auth is optional, but if token exists, verify it
 */
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token;

    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      req.auth = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    req.auth = {
      accountId: decoded.sub,
      role: decoded.role,
      userId: decoded.userId || null,
      driverId: decoded.driverId || null,
    };

    next();
  } catch (err) {
    // Invalid token but optional, so continue without auth
    req.auth = null;
    next();
  }
}
