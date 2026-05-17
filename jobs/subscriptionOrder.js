import cron from "node-cron";
import { Subscription } from "../models/Subscriptions.js";
import { SubOrder } from "../models/suborder.js";
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
        const alreadyExists = await SubOrder.findOne({
          subscription: sub._id,
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        if (alreadyExists) continue;

        const price = sub.product?.price || 0;
        const total = price * sub.quantity;

        await SubOrder.create({
          user: sub.user,
          subscription: sub._id,

          item: {
            _id: String(sub.product._id),
            name: sub.product.name,
            price,
            qty: sub.quantity
          },

          address: sub.address,
          total,
          status: "approved"
        });

        createdCount++;
      }

      console.log(`🥛 Subscription Orders Created: ${createdCount}`);
    } catch (err) {
      console.log("SUBSCRIPTION CRON ERROR:", err.message);
    }
  });
};