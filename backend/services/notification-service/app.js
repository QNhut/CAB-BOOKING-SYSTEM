import express from "express";
import cors from "cors";
import notificationRoutes from "./routes/notification.routes.js";

const app = express();

app.use(cors({ origin: "*", credentials: false }));
app.use(express.json());
app.use(notificationRoutes);

export default app;
