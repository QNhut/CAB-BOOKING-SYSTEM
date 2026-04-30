import { Router } from "express";
import { healthCheck, debugClients, sseStream, sendNotification, getNotifications } from "../controllers/notification.controller.js";

const router = Router();

router.get("/health",                   healthCheck);
router.get("/notifications/health",     healthCheck);
router.get("/notifications/stream",     sseStream);
router.post("/notifications",            sendNotification);
router.get("/notifications",             getNotifications);
router.get("/notifications/debug",      debugClients);

export default router;
