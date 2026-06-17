import express from "express";
import { isDeliveryAuth } from "../middlewares/isDeliveryAuth.js";
import {
  getZoneOrders,
  startDelivery,
  completeDelivery,
  approveOrder,
  getDailySummary,
  sendOrderOTP,
} from "../controllers/deliveryOrderController.js";

const router = express.Router();

router.get("/zone", isDeliveryAuth, getZoneOrders);
router.put("/approve/:id", isDeliveryAuth, approveOrder);
router.put("/start/:id", isDeliveryAuth, startDelivery);
router.post("/send-otp/:id", isDeliveryAuth, sendOrderOTP);
router.put("/complete/:id", isDeliveryAuth, completeDelivery);
router.get("/summary", isDeliveryAuth, getDailySummary);

export default router;