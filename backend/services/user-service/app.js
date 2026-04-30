import express from "express";
import cors from "cors";
import { userRoutes } from "./routes/user.routes.js";
import { migrate, log } from "./models/user.model.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(userRoutes);

app.get("/metrics", (_req, res) => {
  res.set("Content-Type", "text/plain");
  res.send(`# HELP user_service_up Whether user-service is running\n# TYPE user_service_up gauge\nuser_service_up 1\n`);
});

export { app, migrate, log };
