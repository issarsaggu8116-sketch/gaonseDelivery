import cron from "node-cron";
import { Order } from "../models/Order.js";
import { DailyDelivery } from "../models/DailyDelivery.js";
import { Subscription } from "../models/Subscription.js";

// format date
const getToday = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

// 🔥 MAIN JOB
export const startDailyDeliveryJob = () => {
  cron.schedule("0 2 * * *", async () => {
    console.log("🚚 Running Daily Delivery Generator...");

    try {
      const today = getToday();

      // avoid duplicate generation
      const exists = await DailyDelivery.findOne({ date: today });
      if (exists) {
        console.log("Already generated for today");
        return;
      }

      // 📦 1. CART ORDERS
      const orders = await Order.find({
        type: "cart",
        status: "approved",
      });

      // 🔁 2. SUBSCRIPTION ORDERS LOGIC
      const subscriptions = await Subscription.find({
        status: "active",
        isDeleted: false,
      }).populate("product");

      const subscriptionOrders = [];

      for (let sub of subscriptions) {
        const todayDay = new Date().toLocaleString("en-US", {
          weekday: "short",
        }).toLowerCase();

        const todayDate = new Date().getDate();

        let isValid = false;

        if (sub.type === "days") {
          isValid = sub.days.includes(todayDay);
        }

        if (sub.type === "dates") {
          isValid = sub.dates.includes(todayDate);
        }

        if (isValid) {
          subscriptionOrders.push({
            user: sub.user,
            items: [
              {
                _id: sub.product._id,
                name: sub.product.name,
                price: sub.product.price,
                qty: sub.quantity,
              },
            ],
            address: sub.address,
            total: sub.product.price * sub.quantity,
            type: "subscription",
            status: "approved",
          });
        }
      }

      // 🧮 GROUP BY ZONE
      const zoneMap = new Map();

      const allOrders = [...orders, ...subscriptionOrders];

      for (let order of allOrders) {
        const zoneId = order.address.zone._id?.toString?.() || order.address.zone;

        if (!zoneMap.has(zoneId)) {
          zoneMap.set(zoneId, {
            zone: zoneId,
            orders: [],
            subscriptionOrders: [],
            totalItems: 0,
          });
        }

        const bucket = zoneMap.get(zoneId);

        bucket.totalItems += order.items.reduce(
          (sum, item) => sum + item.qty,
          0
        );

        if (order.type === "subscription") {
          bucket.subscriptionOrders.push(order);
        } else {
          bucket.orders.push(order);
        }
      }

      // 💾 SAVE DAILY DOCS
      for (let [zoneId, data] of zoneMap) {
        await DailyDelivery.create({
          date: today,
          zone: zoneId,
          orders: data.orders.map((o) => o._id),
          subscriptionOrders: data.subscriptionOrders.map((o) => o._id),
          totalItems: data.totalItems,
        });
      }

      console.log("✅ Daily Delivery Generated Successfully");
    } catch (err) {
      console.log("❌ CRON ERROR:", err.message);
    }
  });
};