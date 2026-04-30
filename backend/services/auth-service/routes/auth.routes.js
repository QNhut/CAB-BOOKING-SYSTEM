import { Router } from "express";
import { authMiddleware, adminAuth } from "../middlewares/auth.middleware.js";
import {
  healthCheck, register, login, refresh, logout,
  getMe, getProfile, updateProfile,
  internalGetUserProfile, internalGetDriverProfile, internalVerifyToken,
  adminListUsers, adminUpdateUser, adminDeleteUser,
} from "../controllers/auth.controller.js";

const router = Router();

// Health
router.get("/health",       healthCheck);
router.get("/auth/health",  healthCheck);

// Public auth
router.post("/auth/register", register);
router.post("/auth/login",    login);
router.post("/auth/refresh",  refresh);
router.post("/auth/logout",   logout);

// Protected auth
router.get("/auth/me",      authMiddleware, getMe);
router.get("/auth/profile", authMiddleware, getProfile);
router.put("/auth/profile", authMiddleware, updateProfile);

// Internal (service-to-service)
router.get( "/internal/profile/user/:accountId",   internalGetUserProfile);
router.get( "/internal/profile/driver/:accountId", internalGetDriverProfile);
router.post("/internal/verify",                    internalVerifyToken);

// Admin
router.get(   "/auth/admin/users",         adminAuth, adminListUsers);
router.put(   "/auth/admin/users/:userId", adminAuth, adminUpdateUser);
router.delete("/auth/admin/users/:userId", adminAuth, adminDeleteUser);

export default router;
