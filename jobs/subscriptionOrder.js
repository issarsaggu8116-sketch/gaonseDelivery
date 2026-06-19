import cron from "node-cron";
import { Subscription } from "../models/Subscriptions.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";

export const generateSubscriptionOrdersInternal = async () => {
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

    // Group subscriptions by user and deliveryTime
    const userGroups = {};

    for (const sub of subscriptions) {
      if (!sub.user || !sub.product) continue;

      const userId = sub.user.toString();
      const deliveryTime = sub.deliveryTime || "morning";
      const key = `${userId}_${deliveryTime}`;

      if (!userGroups[key]) {
        userGroups[key] = {
          user: sub.user,
          deliveryTime,
          address: sub.address,
          subscriptions: []
        };
      }
      userGroups[key].subscriptions.push(sub);
    }

    let createdCount = 0;

    for (const key of Object.keys(userGroups)) {
      const group = userGroups[key];

      // Check if a subscription order already exists today for this user and deliveryTime
      const alreadyExists = await Order.findOne({
        user: group.user,
        type: "suborder",
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        deliveryTime: group.deliveryTime
      });

      if (alreadyExists) continue;

      const items = group.subscriptions.map((s) => ({
        _id: String(s.product._id),
        name: s.product.name,
        price: s.product.price || 0,
        qty: s.quantity
      }));

      const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

      const order = await Order.create({
        user: group.user,
        items,
        address: group.address,
        total,
        type: "suborder",
        status: "pending",
        deliveredBy: null,
        deliveryTime: group.deliveryTime,
        date: new Date().toISOString()
      });

      // Notify partners in this zone via global socket server
      if (global.io) {
        const zoneId = group.address.zone._id?.toString() || group.address.zone.toString();
        global.io.to(zoneId).emit("newOrder", order);
      }

      createdCount++;
    }

    console.log(`🥛 Subscription Orders Created in orders: ${createdCount}`);
  } catch (err) {
    console.log("SUBSCRIPTION CRON ERROR:", err.message);
  }
};

export const generateTodaySubscriptionOrders = () => {
  // Catch up on startup
  generateSubscriptionOrdersInternal();

  // Schedule daily cron
  cron.schedule("13 0 * * *", generateSubscriptionOrdersInternal);
};