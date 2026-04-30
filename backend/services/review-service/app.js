import express from "express";
import cors from "cors";
import reviewRoutes from "./routes/review.routes.js";
import { migrate, log } from "./models/review.model.js";

const app  = express();

app.use(cors());
app.use(express.json());
app.use(reviewRoutes);

export { app, migrate, log };
