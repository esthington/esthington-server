"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bankAccountController_1 = require("../controllers/bankAccountController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.get("/", authMiddleware_1.protect, bankAccountController_1.getBankAccounts);
router.post("/", authMiddleware_1.protect, bankAccountController_1.addBankAccount);
router.put("/:id", authMiddleware_1.protect, bankAccountController_1.updateBankAccount);
router.delete("/:id", authMiddleware_1.protect, bankAccountController_1.deleteBankAccount);
router.put("/:id/default", authMiddleware_1.protect, bankAccountController_1.setDefaultBankAccount);
exports.default = router;
//# sourceMappingURL=bankAccountRoutes.js.map