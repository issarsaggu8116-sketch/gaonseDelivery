import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const deliveryPartnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    zone: {
      type: mongoose.Schema.ObjectId,
      ref: "Zone",
      required: true,
    },

    city: {
      type: mongoose.Schema.ObjectId,
      ref: "City",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

//
// 🔐 HASH PASSWORD (ASYNC STYLE - NO next)
//
deliveryPartnerSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 10);
});

//
// 🔑 COMPARE PASSWORD
//
deliveryPartnerSchema.methods.comparePassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

export const DeliveryPartner = mongoose.model(
  "DeliveryPartner",
  deliveryPartnerSchema
);