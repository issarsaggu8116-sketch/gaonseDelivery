import express from "express";
import { City } from "../models/city.js";

const router = express.Router();

/* =========================================
   GET ALL CITIES
   GET /api/delivery/cities
========================================= */
router.get("/", async (req, res) => {
  try {
    const cities = await City.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: cities.length,
      cities,
    });
  } catch (error) {
    console.log("CITY FETCH ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch cities",
    });
  }
});

/* =========================================
   GET SINGLE CITY BY ID
   GET /api/delivery/cities/:id
========================================= */
router.get("/:id", async (req, res) => {
  try {
    const city = await City.findById(req.params.id);

    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found",
      });
    }

    res.status(200).json({
      success: true,
      city,
    });
  } catch (error) {
    console.log("CITY SINGLE ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch city",
    });
  }
});

export default router;