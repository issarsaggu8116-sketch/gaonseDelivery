import mongoose from "mongoose";

const zoneSchema = new mongoose.Schema({
  name: String,
  center: {
    lat: Number,
    lng: Number,
  },
  radius: Number,
});

export const Zone = mongoose.model("Zone", zoneSchema);