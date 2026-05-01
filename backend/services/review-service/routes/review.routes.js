import { Router } from "express";
import { authMiddleware, healthCheck, createReview, listDriverReviews, driverStats, bookingReview } from "../controllers/review.controller.js";

const router = Router();

router.get( "/health",                         healthCheck);
router.post("/reviews",                        authMiddleware, createReview);
router.get( "/reviews/driver/:driverId",       listDriverReviews);
router.get( "/reviews/driver/:driverId/stats", driverStats);
router.get( "/reviews/booking/:bookingId",     bookingReview);

export default router;
