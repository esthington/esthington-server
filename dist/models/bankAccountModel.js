"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const bankAccountSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    bankName: {
        type: String,
        required: [true, "Bank name is required"],
        trim: true,
    },
    accountName: {
        type: String,
        required: [true, "Account name is required"],
        trim: true,
    },
    accountNumber: {
        type: String,
        required: [true, "Account number is required"],
        trim: true,
    },
    routingNumber: {
        type: String,
        trim: true,
    },
    swiftCode: {
        type: String,
        trim: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});
// Ensure only one default account per user
bankAccountSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isDefault) {
            yield this.model("BankAccount").updateMany({ user: this.user, _id: { $ne: this._id } }, { isDefault: false });
        }
        next();
    });
});
const BankAccount = mongoose_1.default.model("BankAccount", bankAccountSchema);
exports.default = BankAccount;
//# sourceMappingURL=bankAccountModel.js.map