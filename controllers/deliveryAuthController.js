import { DeliveryPartner } from "../models/DeliveryPartner.js";
import jwt from "jsonwebtoken";

// 🔐 LOGIN
export const loginDeliveryPartner = async (req, res) => {
  
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone & password required" });
    }

    const partner = await DeliveryPartner.findOne({ phone }).select("+password");

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    if (!partner.isActive) {
      return res.status(403).json({ message: "Account disabled" });
    }

    const match = await partner.comparePassword(password);

    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: partner._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      partner: {
        _id: partner._id,
        name: partner.name,
        phone: partner.phone,
        zone: partner.zone,
        city: partner.city,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};