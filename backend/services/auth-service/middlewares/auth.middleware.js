import jwt from "jsonwebtoken";

const JWT_SECRET   = process.env.JWT_SECRET   || "dev-secret-change-me";
const JWT_ISSUER   = "taxi-auth-service";
const JWT_AUDIENCE = "taxi-platform";

/** Middleware to verify JWT and extract auth data. */
export function authMiddleware(req, res, next) {
  try {
    const authHeader  = req.headers.authorization;
    const queryToken  = req.query.token;

    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer:   JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    req.auth = {
      accountId: decoded.sub,
      role:      decoded.role,
      userId:    decoded.userId   || null,
      driverId:  decoded.driverId || null,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
}

/** Middleware that requires ADMIN role. */
export function adminAuth(req, res, next) {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
    if (decoded.role !== "ADMIN") {
      return res.status(403).json({ error: "Access denied" });
    }
    req.auth = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ error: "Token expired" });
    return res.status(401).json({ error: "Invalid token" });
  }
}
