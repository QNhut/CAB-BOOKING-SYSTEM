import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";

export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token   = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== "DRIVER") return res.status(403).json({ error: "Forbidden: DRIVER role required" });
      req.auth = { accountId: decoded.sub, role: decoded.role, driverId: decoded.driverId };
      return next();
    }
    const legacyId = req.header("x-driver-id");
    if (legacyId) {
      req.auth = { driverId: legacyId, role: "DRIVER", accountId: null };
      return next();
    }
    return res.status(401).json({ error: "Missing authentication (Bearer token or x-driver-id)" });
  } catch (err) {
    if (err.name === "JsonWebTokenError") return res.status(401).json({ error: "Invalid token" });
    if (err.name === "TokenExpiredError") return res.status(401).json({ error: "Token expired" });
    return res.status(500).json({ error: err.message });
  }
}

export function getDriverId(req) {
  if (!req.auth?.driverId) throw new Error("Missing driverId");
  return req.auth.driverId;
}
