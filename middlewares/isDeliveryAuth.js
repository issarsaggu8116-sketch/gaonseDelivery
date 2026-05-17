import jwt from "jsonwebtoken";
import { DeliveryPartner } from "../models/DeliveryPartner.js";

export const isDeliveryAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const partner = await DeliveryPartner.findById(decoded.id);

    if (!partner) {
      return res.status(401).json({ message: "Invalid partner" });
    }

    if (!partner.isActive) {
      return res.status(403).json({ message: "Account disabled" });
    }

    req.partner = partner;
    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
};