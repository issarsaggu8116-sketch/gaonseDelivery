import express from "express";

import {
  generateSubscriptionOrders,
  getTodaySubOrders,
  startSubOrderDelivery,
  completeAndDeleteSubOrder,
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
/* ✅ Mark Delivered */
/* ---------------------------------- */
router.put(
  "/:id/deliver",
  isDeliveryAuth,
  completeAndDeleteSubOrder
);


export default router;
