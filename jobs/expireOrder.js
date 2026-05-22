import cron from "node-cron";
import { Order } from "../models/Order.js";

export const expirePendingOrders = () => {
  // runs every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    try {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

      const result = await Order.updateMany(
        {
          status: "pending",
          createdAt: { $lte: sixHoursAgo },
        },
        {
          $set: { status: "expired" },
        }
      );

      console.log(`⏳ Expired Orders: ${result.modifiedCount}`);
    } catch (err) {
      console.log("CRON ERROR:", err.message);
    }
  });
};