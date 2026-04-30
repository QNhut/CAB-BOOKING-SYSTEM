import { Router } from "express";
import { healthCheck, estimatePrice, updateSurge, getSurge, simplePrice } from "../controllers/pricing.controller.js";

const router = Router();

router.get( "/health",           healthCheck);
router.get( "/pricing/health",   healthCheck);
router.post("/pricing",          simplePrice);
router.post("/pricing/estimate", estimatePrice);
router.post("/pricing/surge",    updateSurge);
router.get( "/pricing/surge",    getSurge);

export default router;
