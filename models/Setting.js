import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({
  city: {
    type: mongoose.Schema.ObjectId,
    ref: "City",
    required: true,
  },

  morningDeadline: {
    type: String, // "00:00"
    default: "00:00",
  },

  eveningDeadline: {
    type: String, // "14:00"
    default: "14:00",
  },

  rupeesPerKm: {
    type: Number,
    default: 10,
  },
});

export const Setting = mongoose.model("Setting", settingSchema);
