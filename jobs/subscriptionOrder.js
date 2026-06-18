import cron from "node-cron";
import { Subscription } from "../models/Subscriptions.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";

export const generateTodaySubscriptionOrders = () => {
  cron.schedule("13 0 * * *", async () => {
    try {
      const now = new Date();

      const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const todayDay = dayMap[now.getDay()];
      const todayDate = now.getDate();

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const subscriptions = await Subscription.find({
        status: "active",
        isDeleted: false,
        $or: [
          { type: "days", days: todayDay },
          { type: "dates", dates: todayDate }
        ]
      }).populate("product");

      let createdCount = 0;

      for (const sub of subscriptions) {
        const alreadyExists = await Order.findOne({
          user: sub.user,
          type: "suborder",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          "items.0._id": String(sub.product._id),
        });

        if (alreadyExists) continue;

        const price = sub.product?.price || 0;
        const total = price * sub.quantity;

        const order = await Order.create({
          user: sub.user,
          items: [
            {
              _id: String(sub.product._id),
              name: sub.product.name,
              price,
              qty: sub.quantity
            }
          ],
          address: sub.address,
          total,
          type: "suborder",
          status: "pending",
          deliveredBy: null,
          date: new Date().toISOString(),
        });

        // Notify partners in this zone via global socket server
        if (global.io) {
          const zoneId = sub.address.zone._id?.toString() || sub.address.zone.toString();
          global.io.to(zoneId).emit("newOrder", order);
        }

        createdCount++;
      }

      console.log(`🥛 Subscription Orders Created in orders: ${createdCount}`);
    } catch (err) {
      console.log("SUBSCRIPTION CRON ERROR:", err.message);
    }
  });
};