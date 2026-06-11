import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    items: [
      {
        _id: String,
        name: String,
        price: Number,
        qty: Number,
      },
    ],

    address: {
      city: Object,
      zone: Object,
      text: String,

      latitude: Number,
      longitude: Number,
    },

    total: Number,

    type: {
      type: String,
      enum: ["cart", "subscription"],
      default: "cart",
    },

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
      default: "pending",
    },

    date: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
