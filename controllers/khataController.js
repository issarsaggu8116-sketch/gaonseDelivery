import { Khata } from "../models/Khata.js";

// 📊 GET KHATA SUMMARY FOR LOGGED-IN PARTNER
export const getKhataSummary = async (req, res) => {
  try {
    const partnerId = req.partner._id;

    const summary = await Khata.aggregate([
      { $match: { partner: partnerId } },
      {
        $group: {
          _id: "$itemName",
          itemName: { $first: "$itemName" },
          totalQty: { $sum: "$qty" },
          totalIncome: { $sum: "$totalPrice" },
        },
      },
      { $sort: { totalQty: -1 } },
    ]);

    const grandTotal = summary.reduce((sum, item) => sum + item.totalIncome, 0);

    res.json({
      success: true,
      summary,
      grandTotal,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
