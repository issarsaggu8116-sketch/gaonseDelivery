// server.js

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

import subOrderRoutes from "./routes/deliverySubscriptionOrderRoutes.js";
import deliveryAuthRoutes from "./routes/deliveryAuthRoutes.js";
import deliveryOrderRoutes from "./routes/deliveryOrderRoutes.js";
import cityRoutes from "./routes/cityRoutes.js";
import userRoutes from "./routes/userRoutes.js"; // 👤 NEW

import { expirePendingOrders } from "./jobs/expireOrder.js";
import { generateTodaySubscriptionOrders } from "./jobs/subscriptionOrder.js";

dotenv.config();

const app = express();

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ DB Connected");

    expirePendingOrders();
    generateTodaySubscriptionOrders();
  })
  .catch((err) => console.log("DB ERROR:", err));

// 🚦 ROUTES
app.use("/api/delivery/auth", deliveryAuthRoutes);
app.use("/api/delivery/today-orders", deliveryOrderRoutes);
app.use("/api/delivery/subscribe-orders", subOrderRoutes);
app.use("/api/delivery/cities", cityRoutes);
app.use("/api/delivery/users", userRoutes); // 👤 NEW

app.listen(4000, () => {
  console.log("🚚 Delivery Server running on port 4000");
});