import { Router } from "express";
import {
  healthCheck, circuitBreakers, adminGetAllRides,
  getUserCurrentRide, userCancelRide,
  getDriverCurrentRide, getDriverRideHistory,
  acceptRide, rejectRide, pickupPassenger, completeRide,
  driverAuthMiddleware, userAuthMiddleware, adminAuthMiddleware,
} from "../controllers/ride.controller.js";

const router = Router();

router.get("/health",                                    healthCheck);
router.get("/rides/health",                              healthCheck);
router.get("/rides/circuit-breakers",                    circuitBreakers);

// Admin
router.get("/rides/admin/all",                           adminAuthMiddleware, adminGetAllRides);

// User
router.get("/users/me/rides/current",                    userAuthMiddleware, getUserCurrentRide);
router.post("/rides/:rideId/user/cancel",                userAuthMiddleware, userCancelRide);

// Driver
router.get("/drivers/me/rides/current",                  driverAuthMiddleware, getDriverCurrentRide);
router.get("/drivers/me/rides/history",                  driverAuthMiddleware, getDriverRideHistory);
router.post("/rides/:rideId/driver/accept",              driverAuthMiddleware, acceptRide);
router.post("/rides/:rideId/driver/reject",              driverAuthMiddleware, rejectRide);
router.post("/rides/:rideId/driver/pickup",              driverAuthMiddleware, pickupPassenger);
router.post("/rides/:rideId/complete",                   driverAuthMiddleware, completeRide);

export default router;
