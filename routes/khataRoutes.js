import express from "express";
import { getKhataSummary } from "../controllers/khataController.js";
import { getDashboardMetrics } from "../controllers/deliveryOrderController.js";
import { isDeliveryAuth } from "../middlewares/isDeliveryAuth.js";

const router = express.Router();

router.get("/summary", isDeliveryAuth, getKhataSummary);
router.get("/metrics", isDeliveryAuth, getDashboardMetrics);

export default router;
