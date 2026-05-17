import express from "express";
import { loginDeliveryPartner } from "../controllers/deliveryAuthController.js";

const router = express.Router();

router.post("/login", loginDeliveryPartner);

export default router;