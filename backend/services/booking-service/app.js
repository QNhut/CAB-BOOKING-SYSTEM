import express from "express";
import cors from "cors";
import bookingRoutes from "./routes/booking.routes.js";
import { runMigrations, pool } from "./config/database.js";
import { createProducer, createConsumer, KAFKA_BOOKING_TOPIC, KAFKA_RIDE_TOPIC } from "./config/kafka.js";
import { uuid } from "./services/booking.service.js";
import { cancelExpiredBookings } from "./models/booking.model.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(bookingRoutes);

export { app, runMigrations, pool, createProducer, createConsumer, KAFKA_BOOKING_TOPIC, KAFKA_RIDE_TOPIC, uuid, cancelExpiredBookings };
