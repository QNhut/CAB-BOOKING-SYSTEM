import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";

export function userAuthMiddleware(req, res, next) {
  const authHeader = req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "USER") {
      return res.status(403).json({ message: "Forbidden: USER role required" });
    }

    req.auth = {
      accountId: decoded.sub,
      role:      decoded.role,
      userId:    decoded.userId || decoded.sub,
    };
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError")  return res.status(401).json({ message: "Token expired" });
    if (err.name === "JsonWebTokenError") {
      // Token may have invalid signature but expired payload — decode without verification
      try {
        const raw = jwt.decode(token);
        if (raw && raw.exp && raw.exp * 1000 < Date.now()) {
          return res.status(401).json({ message: "Token expired" });
        }
      } catch {}
      return res.status(401).json({ message: "Invalid token" });
    }
    return res.status(500).json({ message: err.message });
  }
}

export function getUserId(req) {
  if (!req.auth?.userId) throw new Error("Missing userId");
  return req.auth.userId;
}
