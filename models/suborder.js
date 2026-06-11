import mongoose from "mongoose";

const subOrderSchema = new mongoose.Schema(
  {
    // 👤 Customer
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔁 Original subscription
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },

    // 🌅 DELIVERY TIME
    deliveryTime: {
      type: String,
      enum: ["morning", "evening"],
      default: "morning",
    },

    // 📦 Product snapshot
    item: {
      _id: String,
      name: String,
      price: Number,
      qty: Number,
    },

    // 📍 Delivery Address Snapshot
    address: {
      city: Object,
      zone: Object,
      text: String,

      latitude: Number,
      longitude: Number,
    },

    // 💰 Final amount
    total: {
      type: Number,
      required: true,
    },

    // 📅 Delivery date for this generated order
    deliveryDate: {
      type: String,
      default: () => new Date().toISOString(),
    },

    // 🚚 Status
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "expired",
      ],
      default: "approved",
    },

    // 💳 Wallet payment state
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    // 🚴 Delivery partner
    deliveredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
    },

    deliveredAt: Date,

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const SubOrder = mongoose.model(
  "SubOrder",
  subOrderSchema
);
