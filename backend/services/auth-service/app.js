import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import authRoutes from "./routes/auth.routes.js";
import { runMigrations, pool } from "./config/database.js";

const app = express();
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

app.use(cors());
app.use(express.json());
app.use(authRoutes);

export { app, runMigrations, pool, BCRYPT_ROUNDS };
