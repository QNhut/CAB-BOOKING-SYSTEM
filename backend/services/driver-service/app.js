import express from "express";
import cors from "cors";
import driverRoutes from "./routes/driver.routes.js";
import { redis } from "./config/redis.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(driverRoutes);

export { app, redis };
