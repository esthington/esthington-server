"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const multer_1 = __importDefault(require("multer"));
const supportTicketController_1 = require("../controllers/supportTicketController");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Configure multer for file uploads
const upload = (0, multer_1.default)({ dest: "uploads/" });
// Protect all routes
router.use(authMiddleware_1.protect);
// Routes for all authenticated users
router.post("/tickets", upload.array("attachments", 5), supportTicketController_1.createTicket);
router.get("/tickets", supportTicketController_1.getUserTickets);
router.get("/tickets/:id", supportTicketController_1.getTicketById);
router.post("/tickets/:id/reply", upload.array("attachments", 5), supportTicketController_1.replyToTicket);
// Admin-only routes
router.use((0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN));
router.get("/admin/tickets", supportTicketController_1.getAllTickets);
router.patch("/tickets/:id/status", supportTicketController_1.updateTicketStatus);
router.patch("/tickets/:id/assign", supportTicketController_1.assignTicket);
exports.default = router;
//# sourceMappingURL=supportTicketRoutes.js.map