import express from "express";
import cors from "cors";
import pricingRoutes from "./routes/pricing.routes.js";
import etaRoutes from "./routes/eta.routes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(pricingRoutes);
app.use(etaRoutes);

export default app;
