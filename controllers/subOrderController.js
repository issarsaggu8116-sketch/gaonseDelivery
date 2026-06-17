import { Zone } from "../models/Zones.js";
import { SubOrder } from "../models/suborder.js";
import { Wallet } from "../models/walletModel.js";
import "../models/User.js";
import { Subscription } from "../models/Subscriptions.js";
import { Khata } from "../models/Khata.js";
import { sendEmail } from "../utils/sendEmail.js";

/* --------------------------------------------------- */
/* 🥛 GENERATE SUBSCRIPTION ORDERS */
/* --------------------------------------------------- */
export const generateSubscriptionOrders = async (req, res) => {
  try {

    const now = new Date();

    const dayMap = [
      "sun",
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
    ];

    const todayDay = dayMap[now.getDay()];
    const todayDate = now.getDate();

    /* 🌅 DELIVERY TIME */
    const deliveryTime =
      req.body.deliveryTime || "morning";

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    /* ---------------------------------- */
    /* 📦 FIND SUBSCRIPTIONS */
    /* ---------------------------------- */
    const partner = req.partner;

const subscriptions = await Subscription.find({
  status: "active",
  isDeleted: false,
  deliveryTime,

  "address.zone._id": partner.zone.toString(),

  $or: [
    {
      type: "days",
      days: todayDay,
    },
    {
      type: "dates",
      dates: todayDate,
    },
  ],
}).populate("product");

    let createdCount = 0;

    for (const sub of subscriptions) {

      /* ---------------------------------- */
      /* 🚫 DUPLICATE CHECK */
      /* ---------------------------------- */
      const alreadyExists = await SubOrder.findOne({

        subscription: sub._id,

        deliveryTime,

        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },

      });

      if (alreadyExists) continue;

      const price = sub.product?.price || 0;

      const total = price * sub.quantity;

      /* ---------------------------------- */
      /* 🧾 CREATE ORDER */
      /* ---------------------------------- */
      await SubOrder.create({

        user: sub.user,

        subscription: sub._id,

        deliveryTime,

        item: {
          _id: String(sub.product._id),
          name: sub.product.name,
          price,
          qty: sub.quantity,
        },

        address: sub.address,

        total,

        status: "approved",

      });

      createdCount++;
    }

    return res.status(200).json({
      success: true,
      message: `${createdCount} ${deliveryTime} subscription orders generated`,
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message,
    });

  }
};

/* --------------------------------------------------- */
/* 📦 GET TODAY SUBORDERS */
/* --------------------------------------------------- */
export const getTodaySubOrders = async (req, res) => {
  try {

    const partner = req.partner;

    const zone = await Zone.findById(
      partner.zone
    );

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const deliveryTime =
      req.query.deliveryTime;

    const filter = {
      createdAt: {
        $gte: start,
        $lte: end,
      },

      "address.zone._id":
        partner.zone.toString(),

      isDeleted: { $ne: true },

      status: {
        $in: [
          "approved",
          "out_for_delivery",
          "delivered",
        ],
      },
    };

    if (deliveryTime) {
      filter.deliveryTime =
        deliveryTime;
    }

    const orders =
      await SubOrder.find(filter)
        .populate(
          "user",
          "name email phone"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.json({
      success: true,

      count: orders.length,

      zoneCenter: {
        lat: zone.center.lat,
        lng: zone.center.lng,
      },

      orders,
    });

  } catch (err) {

    console.log(
      "FETCH SUBORDERS ERROR:",
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch today's subscription orders",
    });

  }
};

/* --------------------------------------------------- */
/* 🚚 START DELIVERY */
/* --------------------------------------------------- */
export const startSubOrderDelivery = async (req, res) => {
  try {

    const order = await SubOrder.findById(
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "SubOrder not found",
      });
    }

    if (order.status !== "approved") {
      return res.status(400).json({
        success: false,
        message:
          "Only approved orders can start delivery",
      });
    }

    order.status = "out_for_delivery";

    order.deliveredBy =
      req.partner?._id || null;

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

    console.log(
      "START DELIVERY ERROR:",
      err.message
    );

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

    const order = await SubOrder.findById(
      req.params.id
    ).populate("user");

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
        message:
          "Order is not out for delivery",
      });
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

    /* ------------------------------- */
    /* 2️⃣ MARK DELIVERED */
    /* ------------------------------- */
    order.status = "delivered";

    order.deliveredAt = new Date();

    await order.save();

    // 📓 Record in Khata
    try {
      await Khata.create({
        partner: req.partner._id,
        orderId: order._id.toString(),
        orderType: "suborder",
        itemName: order.item.name,
        qty: order.item.qty,
        price: order.item.price,
        totalPrice: order.item.price * order.item.qty,
        deliveredAt: order.deliveredAt,
      });
    } catch (khataErr) {
      console.log("Failed to save to Khata:", khataErr.message);
    }

    req.io?.emit(
      "subOrderDelivered",
      order
    );

    /* ------------------------------- */
    /* 3️⃣ WALLET CHECK */
    /* ------------------------------- */
    const wallet = await Wallet.findOne({
      user: order.user,
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    if (wallet.balance < order.total) {
      return res.status(400).json({
        success: false,
        message:
          "Insufficient wallet balance",
      });
    }

    /* ------------------------------- */
    /* 4️⃣ DEDUCT WALLET */
    /* ------------------------------- */
    wallet.balance -= order.total;

    await wallet.save();

    /* ------------------------------- */
    /* 5️⃣ KEEP ORDER (SOFT-DELETE READY) */
    /* ------------------------------- */
    // Keep in DB for duplicate prevention. Do not hard-delete.
    order.isDeleted = false;
    await order.save();

    req.io?.emit(
      "subOrderDelivered",
      order
    );

    /* ------------------------------- */
    /* 6️⃣ FINAL RESPONSE */
    /* ------------------------------- */
    return res.json({
      success: true,
      message:
        "Delivered & billed successfully",
      walletBalance: wallet.balance,
    });

  } catch (err) {

    console.log(
      "SUBORDER FLOW ERROR:",
      err.message
    );

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });

  }
};

// 📧 SEND OTP FOR SUBSCRIPTION ORDER DELIVERY
export const sendSubOrderOTP = async (req, res) => {
  try {
    const order = await SubOrder.findById(req.params.id).populate("user");
    if (!order) {
      return res.status(404).json({ success: false, message: "Subscription order not found" });
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
      subject: `GAON SE - Delivery OTP for Subscription Order #${order._id}`,
      message: `
        <h2>GAON SE Delivery OTP</h2>
        <p>Dear ${order.user.name || "Customer"},</p>
        <p>Your OTP to verify your subscription delivery is: <b style="font-size: 18px; color: #1b5e20;">${otp}</b></p>
        <p>Please share this OTP with the delivery partner to confirm receipt of your items.</p>
        <p>This OTP is valid for 15 minutes.</p>
      `,
    });

    res.json({ success: true, message: "OTP sent successfully to customer's email" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🗑️ SOFT DELETE SUBSCRIPTION ORDER FOR TODAY
export const deleteSubOrder = async (req, res) => {
  try {
    const order = await SubOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Subscription order not found" });
    }

    order.isDeleted = true;
    await order.save();

    req.io?.emit("subOrderDeleted", req.params.id);

    res.json({ success: true, message: "Subscription order hidden successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
