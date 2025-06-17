import { Router, Request, Response } from "express";
import {  protect } from "../middleware/authMiddleware";
import { DashboardController } from "../controllers/dashboardController";

const router = Router();

// Apply authentication middleware to all dashboard routes
router.use(protect);

// Dashboard statistics (admin only)
router.get("/stats", DashboardController.getDashboardStats);

// Recent activity (admin only)
router.get("/activity", DashboardController.getRecentActivity);

// Dashboard analytics (admin only)
router.get(
  "/analytics",
  DashboardController.getDashboardAnalytics
);

// Export dashboard data (admin only)
// router.get("/export/:format", async (req: Request, res: Response) => {
//   try {
//     const { format } = req.params;

//     if (!["csv", "pdf", "excel"].includes(format)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid export format. Supported formats: csv, pdf, excel",
//       });
//     }

//     // Implementation would depend on your export library
//     // For now, return a success message
//     res.status(200).json({
//       success: true,
//       message: `Export in ${format} format initiated`,
//       data: { format, timestamp: new Date().toISOString() },
//     });
//   } catch (error) {
//     console.error("Error exporting dashboard data:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to export dashboard data",
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// });

export default router;
