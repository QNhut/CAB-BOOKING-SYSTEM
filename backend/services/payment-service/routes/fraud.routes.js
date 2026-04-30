const { Router } = require("express");
const { healthCheck, fraudStats, fraudCheck, detectFraud } = require("../controllers/fraud.controller.js");

const router = Router();

router.get( "/fraud/health", healthCheck);
router.post("/fraud/check",  fraudCheck);
router.post("/fraud/detect", detectFraud);
router.get( "/fraud/stats",  fraudStats);

module.exports = router;
