import { Router } from "express";
import { userAuthMiddleware } from "../middlewares/auth.middleware.js";
import {
  healthCheck, getMyActiveBooking, createBooking, getBooking,
  getMyHistory, internalBatch, viewOutbox, cancelUserBooking,
  listBookings, updateBookingStatus,
} from "../controllers/booking.controller.js";

const router = Router();

router.get( "/health",                   healthCheck);
router.get( "/bookings/health",          healthCheck);
router.get( "/bookings/me/active",       userAuthMiddleware, getMyActiveBooking);
router.get( "/bookings/me/history",      userAuthMiddleware, getMyHistory);
router.get( "/bookings",                 userAuthMiddleware, listBookings);
router.post("/bookings",                 userAuthMiddleware, createBooking);
router.put( "/bookings/:id/status",      updateBookingStatus);
router.get( "/bookings/:id",             getBooking);
router.post("/bookings/internal/batch",  internalBatch);
router.get( "/outbox",                   viewOutbox);
router.post("/bookings/:id/cancel",      userAuthMiddleware, cancelUserBooking);

export default router;
