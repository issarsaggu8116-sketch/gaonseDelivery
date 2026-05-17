import mongoose from "mongoose";

const dailyDeliverySchema = new mongoose.Schema(
  {
    date: {
      type: String, // "2026-04-16"
      required: true,
      index: true,
    },

    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: true,
    },

    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],

    subscriptionOrders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],

    totalItems: {
      type: Number,
      default: 0,
    },

    isGenerated: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const DailyDelivery = mongoose.model(
  "DailyDelivery",
  dailyDeliverySchema
);