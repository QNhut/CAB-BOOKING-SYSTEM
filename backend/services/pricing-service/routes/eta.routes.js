import { Router } from "express";
import { healthCheck, modelInfo, predict, forecast, getDrift, getMetrics, aiEta, aiForecast } from "../controllers/eta.controller.js";

const router = Router();

router.get( "/health",          healthCheck);
router.post("/eta",             aiEta);      // alias: POST /eta → same as /ai/eta
router.post("/eta/predict",     predict);
router.get( "/eta/forecast",    forecast);
router.get( "/eta/model-info",  modelInfo);
router.get( "/eta/drift",       getDrift);
router.get( "/eta/metrics",     getMetrics);
router.get( "/metrics",         getMetrics);
router.post("/ai/eta",          aiEta);
router.post("/ai/forecast",     aiForecast);

export default router;
