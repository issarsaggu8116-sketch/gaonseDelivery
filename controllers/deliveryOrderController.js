import { Order } from "../models/Order.js";
import {Wallet} from "../models/walletModel.js";
import { SubOrder } from "../models/suborder.js";
import { Zone } from "../models/Zones.js";
import { Khata } from "../models/Khata.js";
import { User } from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";
import { Setting } from "../models/Setting.js";
import { Product } from "../models/Product.js";

// Haversine formula to calculate distance in km
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === undefined || lat1 === null || isNaN(lat1) ||
    lon1 === undefined || lon1 === null || isNaN(lon1) ||
    lat2 === undefined || lat2 === null || isNaN(lat2) ||
    lon2 === undefined || lon2 === null || isNaN(lon2)
  ) {
    return 0;
  }
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};


// 📦 GET ZONE ORDERS
export const getZoneOrders = async (req, res) => {
  try {
    const partner = req.partner;

    const zone = await Zone.findById(
      partner.zone
    );

    const orders = await Order.find({
      "address.zone._id": partner.zone.toString(),
      deliveredBy: partner._id,
      type: { $in: ["cart", "normal"] },
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
    const order = await Order.findOne({ _id: req.params.id, deliveredBy: req.partner._id });

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
    const order = await Order.findOne({ _id: req.params.id, deliveredBy: req.partner._id });

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
    
    // Calculate distance-based earnings
    let rupeesPerKm = 10;
    try {
      const setting = await Setting.findOne({ city: req.partner.city });
      if (setting && setting.rupeesPerKm !== undefined) {
        rupeesPerKm = setting.rupeesPerKm;
      }
    } catch (settingErr) {
      console.log("Failed to fetch settings:", settingErr.message);
    }

    let earning = 0;
    try {
      const zone = await Zone.findById(req.partner.zone);
      if (zone && zone.center && zone.center.lat !== undefined && zone.center.lng !== undefined) {
        const dist = calculateDistance(
          zone.center.lat,
          zone.center.lng,
          order.address.latitude,
          order.address.longitude
        );
        earning = Number((dist * rupeesPerKm).toFixed(2));
      }
    } catch (zoneErr) {
      console.log("Failed to fetch zone or calculate distance:", zoneErr.message);
    }

    // 🚚 Complete delivery
    order.status = "delivered";
    order.deliveredAt = new Date();
    order.deliveredBy = req.partner._id;
    order.paymentStatus = "paid";
    order.otp = null;
    order.otpExpire = null;
    order.earning = earning;

    await order.save();

    // 📦 Deduct Stock from Inventory
    try {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item._id,
          { $inc: { currentStock: -item.qty } }
        );
      }
    } catch (stockErr) {
      console.log("Failed to deduct stock:", stockErr.message);
    }

    // 📓 Record in Khata
    try {
      const orderType = (order.type === "subscription" || order.type === "suborder") ? "suborder" : "order";
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        await Khata.create({
          partner: req.partner._id,
          orderId: order._id.toString(),
          orderType: orderType,
          itemName: item.name,
          qty: item.qty,
          price: item.price,
          totalPrice: item.price * item.qty,
          earning: i === 0 ? earning : 0,
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
    const order = await Order.findOne({ _id: req.params.id, deliveredBy: req.partner._id }).populate("user");
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
            totalAmount: { $sum: "$earning" },
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
      "address.zone._id": partner.zone.toString(),
      deliveredBy: partner._id,
      type: { $in: ["cart", "normal"] },
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
    const subOrders = await Order.find({
      "address.zone._id": partner.zone.toString(),
      deliveredBy: partner._id,
      type: { $in: ["subscription", "suborder"] },
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

      totalAmount += (order.earning || 0);

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
      totalAmount += (order.earning || 0);

      order.items?.forEach((item) => {
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
        itemsMap[key].subscriptionQty += item.qty;
        itemsMap[key].totalAmount += item.price * item.qty;
      });
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
      deliveredBy: partner._id,
      type: { $in: ["cart", "normal"] },
      status: { $in: ["approved", "out_for_delivery"] },
    });

    const pendingSubOrdersCount = await Order.countDocuments({
      "address.zone._id": partner.zone.toString(),
      deliveredBy: partner._id,
      type: { $in: ["subscription", "suborder"] },
      status: { $in: ["approved", "out_for_delivery"] },
    });

    const unassignedOrdersCount = await Order.countDocuments({
      "address.zone._id": partner.zone.toString(),
      status: "pending",
      deliveredBy: null,
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
          totalEarnings: { $sum: "$earning" },
        },
      },
    ]);

    const todayEarnings = summary.length > 0 ? summary[0].totalEarnings : 0;

    res.json({
      success: true,
      pendingOrdersCount: totalPending,
      unassignedOrdersCount,
      todayEarnings,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// 📦 GET UNASSIGNED ZONE ORDERS
export const getUnassignedZoneOrders = async (req, res) => {
  try {
    const partner = req.partner;

    const zone = await Zone.findById(partner.zone);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found" });
    }

    const orders = await Order.find({
      "address.zone._id": partner.zone.toString(),
      status: "pending",
      deliveredBy: null,
    })
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    // Fetch rupeesPerKm setting for the city
    let rupeesPerKm = 10;
    try {
      const setting = await Setting.findOne({ city: partner.city });
      if (setting && setting.rupeesPerKm !== undefined) {
        rupeesPerKm = setting.rupeesPerKm;
      }
    } catch (settingErr) {
      console.log("Failed to fetch settings in getUnassignedZoneOrders:", settingErr.message);
    }

    // Map orders to include estimated earning
    const ordersWithEarning = orders.map(o => {
      let estimatedEarning = 0;
      if (zone.center && zone.center.lat !== undefined && zone.center.lng !== undefined) {
        const dist = calculateDistance(
          zone.center.lat,
          zone.center.lng,
          o.address?.latitude,
          o.address?.longitude
        );
        estimatedEarning = Number((dist * rupeesPerKm).toFixed(2));
      }
      return {
        ...o.toObject(),
        earning: estimatedEarning
      };
    });

    res.json({
      success: true,
      count: ordersWithEarning.length,
      partnerZoneId: partner.zone.toString(),
      zoneCenter: {
        lat: zone.center.lat,
        lng: zone.center.lng,
      },
      orders: ordersWithEarning,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🚴 ACCEPT ORDER
export const acceptOrder = async (req, res) => {
  try {
    const partner = req.partner;
    const orderId = req.params.id;

    // Check if the order is available to accept
    const order = await Order.findOne({
      _id: orderId,
      status: "pending",
      deliveredBy: null,
      "address.zone._id": partner.zone.toString(),
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Order already accepted by another partner or does not exist",
      });
    }

    // Calculate distance-based earnings
    let rupeesPerKm = 10;
    try {
      const setting = await Setting.findOne({ city: partner.city });
      if (setting && setting.rupeesPerKm !== undefined) {
        rupeesPerKm = setting.rupeesPerKm;
      }
    } catch (settingErr) {
      console.log("Failed to fetch settings in acceptOrder:", settingErr.message);
    }

    let earning = 0;
    try {
      const zone = await Zone.findById(partner.zone);
      if (zone && zone.center && zone.center.lat !== undefined && zone.center.lng !== undefined) {
        const dist = calculateDistance(
          zone.center.lat,
          zone.center.lng,
          order.address.latitude,
          order.address.longitude
        );
        earning = Number((dist * rupeesPerKm).toFixed(2));
      }
    } catch (zoneErr) {
      console.log("Failed to fetch zone or calculate distance in acceptOrder:", zoneErr.message);
    }

    // Assign to partner atomically (double check availability)
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: "pending",
        deliveredBy: null,
      },
      {
        $set: {
          deliveredBy: partner._id,
          status: "approved",
          earning: earning,
        },
      },
      { new: true }
    ).populate("user", "name email phone");

    if (!updatedOrder) {
      return res.status(400).json({
        success: false,
        message: "Order already accepted by another partner",
      });
    }

    // Notify other partners in the zone
    if (req.io) {
      req.io.to(partner.zone.toString()).emit("orderAcceptedByPartner", {
        orderId: updatedOrder._id,
        deliveredBy: partner._id,
        deliveredByName: partner.name,
      });
    }

    res.json({
      success: true,
      message: "Order accepted successfully",
      order: updatedOrder,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📡 NOTIFY NEW ORDER (INTERNAL WEBHOOK)
export const notifyNewOrder = async (req, res) => {
  try {
    const { order } = req.body;
    if (order && req.io) {
      const zoneId = order.address?.zone?._id?.toString() || order.address?.zone?.toString();
      if (zoneId) {
        req.io.to(zoneId).emit("newOrder", order);
        console.log(`📡 Broadcasted newOrder to zone room: ${zoneId}`);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
