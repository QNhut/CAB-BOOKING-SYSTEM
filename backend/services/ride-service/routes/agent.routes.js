import { Router } from "express";
import {
  healthCheck, modelInfo, circuitBreakers, listDecisions, getDecision, metrics,
  agentContext, callToolEndpoint, selectDriver,
  matchDriver, agentDecide, agentLogs, recommendDrivers, aiModelInfo, mcpContext,
} from "../controllers/agent.controller.js";

const router = Router();

router.get( "/health",                      healthCheck);
router.get( "/agent/model-info",            modelInfo);
router.get( "/agent/circuit-breakers",      circuitBreakers);
router.get( "/agent/decisions",             listDecisions);
router.get( "/agent/decisions/:requestId",  getDecision);
router.get( "/agent/context",               agentContext);
router.post("/agent/call-tool",             callToolEndpoint);
router.post("/agent/select-driver",         selectDriver);
router.get( "/metrics",                     metrics);

// /ai/* routes (proxied from api-gateway /ai → agent-service)
router.get( "/ai/model-info",               aiModelInfo);
router.post("/ai/mcp/context",              mcpContext);
router.post("/ai/recommend-drivers",        recommendDrivers);
router.post("/ai/agent/match-driver",       matchDriver);
router.post("/ai/agent/decide",             agentDecide);
router.get( "/ai/agent/logs",               agentLogs);

export default router;
