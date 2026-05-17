// routes/userRoutes.js

import express from "express";
import { User } from "../models/User.js";

const router = express.Router();

/* =====================================
   GET ALL USERS (ONLY _id + phone)
   GET /api/delivery/users
===================================== */
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("_id phone");

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.log("USER FETCH ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

/* =====================================
   GET SINGLE USER
   GET /api/delivery/users/:id
===================================== */
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "_id phone name"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.log("USER SINGLE ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
});

export default router;