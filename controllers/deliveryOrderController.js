import { Order } from "../models/Order.js";
import {Wallet} from "../models/walletModel.js";

// 📦 GET ZONE ORDERS
export const getZoneOrders = async (req, res) => {
  try {
    const partner = req.partner;

    const orders = await Order.find({
  "address.zone._id": partner.zone.toString(), // ✅ FIX
  status: { $in: ["approved", "out_for_delivery"] },
}).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🚚 START DELIVERY
export const startDelivery = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "approved") {
      return res.status(400).json({ message: "Invalid state" });
    }

    order.status = "out_for_delivery";
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ COMPLETE DELIVERY + WALLET DEDUCTION READY
export const completeDelivery = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "out_for_delivery") {
      return res.status(400).json({ message: "Invalid state" });
    }

    // 🪙 Find user wallet
    const wallet = await Wallet.findOne({ user: order.user });
    
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // 💸 Check balance
    if (wallet.balance < order.total) {
      return res.status(400).json({
        message: "Insufficient wallet balance",
      });
    }
    
    // 💰 Deduct amount
    wallet.balance -= order.total;


    // 📝 Optional transaction history
    // wallet.transactions.push({
    //   type: "debit",
    //   amount: order.total,
    //   message: `Payment for Order #${order._id}`,
    //   orderId: order._id,
    //   date: new Date(),
    // });
 
    await wallet.save();
    
    // 🚚 Complete delivery
    order.status = "delivered";
    order.deliveredAt = new Date();
    order.deliveredBy = req.partner._id;
    order.paymentStatus = "paid";

    await order.save();

    // 📡 Optional realtime socket emit
    if (req.io) {
      req.io.emit("orderDelivered", order);
    }

    res.json({
      success: true,
      message: "Delivered successfully & wallet deducted",
      order,
      walletBalance: wallet.balance,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ APPROVE ORDER (TEMP - FOR DELIVERY APP)
export const approveOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    if (order.status !== "pending") {
      return res.status(400).json({ message: "Only pending can be approved" });
    }

    order.status = "approved";
    await order.save();

    res.json({
      success: true,
      message: "Order approved",
      order,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📊 DAILY SUMMARY
export const getDailySummary = async (req, res) => {
  try {

    const partner = req.partner;

    /* ---------------------------------- */
    /* 📦 NORMAL ORDERS */
    /* ---------------------------------- */
    const orders = await Order.find({
      "address.zone._id":
        partner.zone.toString(),

      status: {
        $in: [
          "approved",
          "out_for_delivery",
        ],
      },
    });

    /* ---------------------------------- */
    /* 🔁 SUBSCRIPTION ORDERS */
    /* ---------------------------------- */
    const subOrders = await SubOrder.find({
      "address.zone._id":
        partner.zone.toString(),

      status: {
        $in: [
          "approved",
          "out_for_delivery",
        ],
      },
    });

    /* ---------------------------------- */
    /* 📊 ITEM SUMMARY MAP */
    /* ---------------------------------- */
    const itemsMap = {};

    let totalAmount = 0;

    let totalOrders =
      orders.length + subOrders.length;

    /* ---------------------------------- */
    /* 📦 NORMAL ORDERS LOOP */
    /* ---------------------------------- */
    orders.forEach((order) => {

      totalAmount += order.total;

      order.items.forEach((item) => {

        const key = item.name;

        if (!itemsMap[key]) {

          itemsMap[key] = {
            name: item.name,

            totalQty: 0,

            normalQty: 0,

            subscriptionQty: 0,

            totalAmount: 0,
          };
        }

        itemsMap[key].totalQty += item.qty;

        itemsMap[key].normalQty += item.qty;

        itemsMap[key].totalAmount +=
          item.price * item.qty;
      });
    });

    /* ---------------------------------- */
    /* 🔁 SUBSCRIPTION ORDERS LOOP */
    /* ---------------------------------- */
    subOrders.forEach((order) => {

      totalAmount += order.total;

      const item =
        order.item;

      const key =
        item?.name;

      if (!itemsMap[key]) {

        itemsMap[key] = {
          name: item.name,

          totalQty: 0,

          normalQty: 0,

          subscriptionQty: 0,

          totalAmount: 0,
        };
      }

      itemsMap[key].totalQty += item.qty;

      itemsMap[key].subscriptionQty += item.qty;

      itemsMap[key].totalAmount +=
        item.price * item.qty;
    });

    /* ---------------------------------- */
    /* 📋 FINAL ARRAY */
    /* ---------------------------------- */
    const itemsSummary =
      Object.values(itemsMap);

    /* ---------------------------------- */
    /* ✅ RESPONSE */
    /* ---------------------------------- */
    res.json({
      success: true,

      totalOrders,

      totalAmount,

      itemsSummary,
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });

  }
};
