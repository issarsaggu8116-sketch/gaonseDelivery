// server.js

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

import subOrderRoutes from "./routes/deliverySubscriptionOrderRoutes.js";
import deliveryAuthRoutes from "./routes/deliveryAuthRoutes.js";
import deliveryOrderRoutes from "./routes/deliveryOrderRoutes.js";
import cityRoutes from "./routes/cityRoutes.js";
import userRoutes from "./routes/userRoutes.js"; // 👤 NEW
import khataRoutes from "./routes/khataRoutes.js";

import { expirePendingOrders } from "./jobs/expireOrder.js";
import { generateTodaySubscriptionOrders } from "./jobs/subscriptionOrder.js";

dotenv.config();

const app = express();
const server = createServer(app);

// 🔌 SOCKET.IO Setup
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

global.io = io;

io.on("connection", (socket) => {
  console.log("⚡ Partner connected:", socket.id);

  socket.on("joinZone", (zoneId) => {
    socket.join(zoneId);
    console.log(`📍 Partner joined zone: ${zoneId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Partner disconnected:", socket.id);
  });
});

// Middleware to attach socket.io to req
app.use((req, res, next) => {
  req.io = global.io;
  next();
});

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
app.use("/api/delivery/khata", khataRoutes);

server.listen(4001, () => {
  console.log("🚚 Delivery Server running on port 4001");
});

export default app;