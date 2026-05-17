import { SubOrder } from "../models/suborder.js";
import {Wallet} from "../models/walletModel.js";
import "../models/User.js";

/* --------------------------------------------------- */
/* 📦 GET TODAY SUBORDERS */
/* --------------------------------------------------- */
export const getTodaySubOrders = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const orders = await SubOrder.find({
      createdAt: { $gte: start, $lte: end },
      status: { $in: ["approved", "out_for_delivery"] },
    })
      .populate("user", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (err) {
    console.log("FETCH SUBORDERS ERROR:", err.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch today's subscription orders",
    });
  }
};

/* --------------------------------------------------- */
/* 🚚 START DELIVERY */
/* --------------------------------------------------- */
export const startSubOrderDelivery = async (req, res) => {
  try {
    const order = await SubOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "SubOrder not found",
      });
    }

    if (order.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved orders can start delivery",
      });
    }

    order.status = "out_for_delivery";
    order.deliveredBy = req.delivery?._id || null;

    await order.save();

    if (req.io) {
      req.io.emit("subOrderStarted", order);
    }

    res.json({
      success: true,
      message: "Delivery started successfully",
      order,
    });
  } catch (err) {
    console.log("START DELIVERY ERROR:", err.message);

    res.status(500).json({
      success: false,
      message: "Failed to start delivery",
    });
  }
};

/* --------------------------------------------------- */
/* ✅ MARK DELIVERED */
/* --------------------------------------------------- */
export const completeAndDeleteSubOrder = async (req, res) => {
  try {
    const order = await SubOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "SubOrder not found",
      });
    }

    /* ------------------------------- */
    /* 1️⃣ MUST BE OUT FOR DELIVERY */
    /* ------------------------------- */
    if (order.status !== "out_for_delivery") {
      return res.status(400).json({
        success: false,
        message: "Order is not out for delivery",
      });
    }

    /* ------------------------------- */
    /* 2️⃣ MARK AS DELIVERED */
    /* ------------------------------- */
    order.status = "delivered";
    order.deliveredAt = new Date();

    await order.save();

    req.io?.emit("subOrderDelivered", order);

    /* ------------------------------- */
    /* 3️⃣ WALLET CHECK */
    /* ------------------------------- */
    const wallet = await Wallet.findOne({ user: order.user });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    if (wallet.balance < order.total) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    /* ------------------------------- */
    /* 4️⃣ DEDUCT WALLET */
    /* ------------------------------- */
    wallet.balance -= order.total;

    await wallet.save();

    /* ------------------------------- */
    /* 5️⃣ DELETE ORDER */
    /* ------------------------------- */
    await SubOrder.findByIdAndDelete(req.params.id);

    req.io?.emit("subOrderDeleted", req.params.id);

    /* ------------------------------- */
    /* 6️⃣ FINAL RESPONSE */
    /* ------------------------------- */
    return res.json({
      success: true,
      message: "Delivered, billed & deleted successfully",
      walletBalance: wallet.balance,
    });

  } catch (err) {
    console.log("SUBORDER FLOW ERROR:", err.message);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};