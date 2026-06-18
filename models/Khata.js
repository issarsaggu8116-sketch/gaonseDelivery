import mongoose from "mongoose";

const khataSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPartner",
      required: true,
    },
    orderId: {
      type: String,
      required: true,
    },
    orderType: {
      type: String,
      enum: ["order", "suborder"],
      required: true,
    },
    itemName: {
      type: String,
      required: true,
    },
    qty: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    earning: {
      type: Number,
      default: 0,
    },
    deliveredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Khata = mongoose.model("Khata", khataSchema);
