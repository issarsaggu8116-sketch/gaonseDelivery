import { Order } from "../models/Order.js";
import {Wallet} from "../models/walletModel.js";
import { SubOrder } from "../models/suborder.js";
import { Zone } from "../models/Zones.js";
import { Khata } from "../models/Khata.js";
import { User } from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";

// 📦 GET ZONE ORDERS
export const getZoneOrders = async (req, res) => {
  try {
    const partner = req.partner;

    const zone = await Zone.findById(
      partner.zone
    );

    const orders = await Order.find({
      "address.zone._id":
        partner.zone.toString(),

      status: {
        $in: [
          "approved",
          "out_for_delivery",
        ],
      },
    })
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,

      zoneCenter: {
        lat: zone.center.lat,
        lng: zone.center.lng,
      },

      orders,
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });

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

    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ success: false, message: "OTP is required" });
    }

    if (!order.otp || order.otp !== Number(otp)) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (Date.now() > new Date(order.otpExpire).getTime()) {
      return res.status(400).json({ success: false, message: "OTP Expired" });
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
    order.otp = null;
    order.otpExpire = null;

    await order.save();

    // 📓 Record in Khata
    try {
      for (const item of order.items) {
        await Khata.create({
          partner: req.partner._id,
          orderId: order._id.toString(),
          orderType: "order",
          itemName: item.name,
          qty: item.qty,
          price: item.price,
          totalPrice: item.price * item.qty,
          deliveredAt: order.deliveredAt,
        });
      }
    } catch (khataErr) {
      console.log("Failed to save to Khata:", khataErr.message);
    }

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

// 📧 SEND OTP FOR ORDER DELIVERY
export const sendOrderOTP = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("user");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "out_for_delivery") {
      return res.status(400).json({ success: false, message: "Order must be out for delivery to send OTP" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    order.otp = otp;
    order.otpExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await order.save();

    const email = order.user?.email;
    if (!email) {
      return res.status(400).json({ success: false, message: "User email not found" });
    }

    await sendEmail({
      email,
      subject: `GAON SE - Delivery OTP for Order #${order._id}`,
      message: `
        <h2>GAON SE Delivery OTP</h2>
        <p>Dear ${order.user.name || "Customer"},</p>
        <p>Your OTP to verify your order delivery is: <b style="font-size: 18px; color: #1b5e20;">${otp}</b></p>
        <p>Please share this OTP with the delivery partner to confirm receipt of your items.</p>
        <p>This OTP is valid for 15 minutes.</p>
      `,
    });

    res.json({ success: true, message: "OTP sent successfully to customer's email" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    const { date, mode } = req.query;

    if (mode === "completed" && date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const summaryList = await Khata.aggregate([
        {
          $match: {
            partner: partner._id,
            deliveredAt: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        {
          $group: {
            _id: "$itemName",
            name: { $first: "$itemName" },
            totalQty: { $sum: "$qty" },
            normalQty: {
              $sum: {
                $cond: [{ $eq: ["$orderType", "order"] }, "$qty", 0],
              },
            },
            subscriptionQty: {
              $sum: {
                $cond: [{ $eq: ["$orderType", "suborder"] }, "$qty", 0],
              },
            },
            totalAmount: { $sum: "$totalPrice" },
          },
        },
        { $sort: { totalQty: -1 } },
      ]);

      const totalAmount = summaryList.reduce((sum, item) => sum + item.totalAmount, 0);
      const totalOrders = await Khata.countDocuments({
        partner: partner._id,
        deliveredAt: { $gte: startOfDay, $lte: endOfDay },
      });

      return res.json({
        success: true,
        totalOrders,
        totalAmount,
        itemsSummary: summaryList,
      });
    }

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

// 📊 GET DASHBOARD METRICS FOR PARTNER HOME
export const getDashboardMetrics = async (req, res) => {
  try {
    const partner = req.partner;

    const pendingOrdersCount = await Order.countDocuments({
      "address.zone._id": partner.zone.toString(),
      status: { $in: ["approved", "out_for_delivery"] },
    });

    const pendingSubOrdersCount = await SubOrder.countDocuments({
      "address.zone._id": partner.zone.toString(),
      status: { $in: ["approved", "out_for_delivery"] },
    });

    const totalPending = pendingOrdersCount + pendingSubOrdersCount;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const summary = await Khata.aggregate([
      {
        $match: {
          partner: partner._id,
          deliveredAt: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$totalPrice" },
        },
      },
    ]);

    const todayEarnings = summary.length > 0 ? summary[0].totalEarnings : 0;

    res.json({
      success: true,
      pendingOrdersCount: totalPending,
      todayEarnings,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
