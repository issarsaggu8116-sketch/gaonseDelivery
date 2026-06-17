import express from "express";

import {
  generateSubscriptionOrders,
  getTodaySubOrders,
  startSubOrderDelivery,
  completeAndDeleteSubOrder,
  sendSubOrderOTP,
  deleteSubOrder,
} from "../controllers/subOrderController.js";

import { isDeliveryAuth } from "../middlewares/isDeliveryAuth.js";

const router = express.Router();

/*
📦 SUBORDER ROUTES
Base URL:
app.use("/api/delivery/subscribe-orders", router)
*/


/* ---------------------------------- */
/* 🥛 Generate Today's Subscription Orders */
/* ---------------------------------- */
router.post(
  "/generate",
  isDeliveryAuth,
  generateSubscriptionOrders
);


/* ---------------------------------- */
/* 📦 Fetch Today's Subscription Orders */
/* ---------------------------------- */
router.get(
  "/today",
  isDeliveryAuth,
  getTodaySubOrders
);


/* ---------------------------------- */
/* 🚚 Start Delivery */
/* ---------------------------------- */
router.put(
  "/:id/start",
  isDeliveryAuth,
  startSubOrderDelivery
);


/* ---------------------------------- */
/* 📧 Send OTP */
/* ---------------------------------- */
router.post(
  "/:id/send-otp",
  isDeliveryAuth,
  sendSubOrderOTP
);


/* ---------------------------------- */
/* ✅ Mark Delivered */
/* ---------------------------------- */
router.put(
  "/:id/deliver",
  isDeliveryAuth,
  completeAndDeleteSubOrder
);


/* ---------------------------------- */
/* 🗑️ Dismiss / Soft Delete Order */
/* ---------------------------------- */
router.delete(
  "/:id",
  isDeliveryAuth,
  deleteSubOrder
);


export default router;