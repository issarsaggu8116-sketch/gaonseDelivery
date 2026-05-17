import jwt from "jsonwebtoken";

export const generateDeliveryToken = (partner) => {
  return jwt.sign(
    {
      id: partner._id,
      role: "delivery",
      zone: partner.zone,
      city: partner.city,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};