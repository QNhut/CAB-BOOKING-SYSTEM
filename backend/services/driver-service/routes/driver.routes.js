import { Router } from "express";
import {
  healthCheck, getMe, setStatus, updateLocation,
  getNearbyDrivers, internalSetState, debugDriver, authMiddleware,
  setDriverStatusById,
} from "../controllers/driver.controller.js";

const router = Router();

router.get( "/health",                              healthCheck);
router.get( "/drivers/health",                      healthCheck);
router.get( "/drivers/me",                          authMiddleware, getMe);
router.post("/drivers/me/status",                   authMiddleware, setStatus);
router.put( "/drivers/:driverId/status",            setDriverStatusById);
router.post("/drivers/me/location",                 authMiddleware, updateLocation);
router.get( "/drivers/nearby",                      getNearbyDrivers);
router.post("/internal/drivers/:driverId/state",    internalSetState);
router.get( "/drivers/:driverId/debug",             debugDriver);

export default router;
