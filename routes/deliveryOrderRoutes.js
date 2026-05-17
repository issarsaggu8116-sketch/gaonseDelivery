import express from "express";
import { isDeliveryAuth } from "../middlewares/isDeliveryAuth.js";
import {
  getZoneOrders,
  startDelivery,
  completeDelivery,
  approveOrder,
  getDailySummary,
} from "../controllers/deliveryOrderController.js";

const router = express.Router();

router.get("/zone", isDeliveryAuth, getZoneOrders);
router.put("/approve/:id", isDeliveryAuth, approveOrder);
router.put("/start/:id", isDeliveryAuth, startDelivery);
router.put("/complete/:id", isDeliveryAuth, completeDelivery);
router.get("/summary", isDeliveryAuth, getDailySummary);

export default router;