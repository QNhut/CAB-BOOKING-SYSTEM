import { Router } from "express";
import { authMiddleware, healthCheck, getPrefs, updatePrefs, listLocations, createLocation, removeLocation, getUserById } from "../controllers/user.controller.js";

const router = Router();

router.get(   "/health",             healthCheck);
router.get(   "/users/health",       healthCheck);
router.get(   "/users/preferences",  authMiddleware, getPrefs);
router.put(   "/users/preferences",  authMiddleware, updatePrefs);
router.get(   "/users/locations",    authMiddleware, listLocations);
router.post(  "/users/locations",    authMiddleware, createLocation);
router.delete("/users/locations/:id",authMiddleware, removeLocation);
router.get(   "/users/:userId",      authMiddleware, getUserById);

export { router as userRoutes };
