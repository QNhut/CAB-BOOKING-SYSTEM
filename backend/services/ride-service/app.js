import express from "express";
import cors from "cors";
import rideRoutes from "./routes/ride.routes.js";
import geoRoutes from "./routes/geo.routes.js";
import agentRoutes from "./routes/agent.routes.js";
import { runMigrations, pool } from "./config/database.js";
import { producer, consumer, BOOKING_TOPIC, RIDE_TOPIC } from "./config/kafka.js";
import { redis } from "./config/redis.js";
import { unlockDriver } from "./config/redis.js";
import { startTimeoutLoop, startRetryLoop, offerNextDriver, fetchNearbyDrivers } from "./services/ride.service.js";
import { alreadyProcessed, markProcessed, insertRide, updateRideCandidates, setRideNoDriverFoundWithRetry, cancelOfferingRidesByBooking, getRideById } from "./models/ride.model.js";

const app = express();
const DRIVER_RETRY_INTERVAL_SEC = Number(process.env.DRIVER_RETRY_INTERVAL_SEC || 10);

app.use(cors());

// Smart JSON parser: skip body parsing for empty GET requests
const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  const ct = req.headers["content-type"] || "";
  const cl = req.headers["content-length"];
  const te = req.headers["transfer-encoding"];
  if (ct.includes("application/json") && !te && (!cl || cl === "0")) {
    req.body = {};
    return next();
  }
  return jsonParser(req, res, next);
});

app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError)
    return res.status(400).json({ error: "Invalid JSON body" });
  return next(err);
});

app.use(rideRoutes);
app.use(geoRoutes);
app.use(agentRoutes);

export { app, runMigrations, pool, producer, consumer, BOOKING_TOPIC, RIDE_TOPIC, redis, unlockDriver, startTimeoutLoop, startRetryLoop, offerNextDriver, fetchNearbyDrivers, alreadyProcessed, markProcessed, insertRide, updateRideCandidates, setRideNoDriverFoundWithRetry, cancelOfferingRidesByBooking, getRideById, DRIVER_RETRY_INTERVAL_SEC };
