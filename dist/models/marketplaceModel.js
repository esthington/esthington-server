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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceInterest = exports.MarketplaceListing = exports.ListingStatus = exports.ListingType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const propertyModel_1 = require("./propertyModel");
var ListingType;
(function (ListingType) {
    ListingType["SALE"] = "sale";
    ListingType["RENT"] = "rent";
    ListingType["LEASE"] = "lease";
})(ListingType || (exports.ListingType = ListingType = {}));
var ListingStatus;
(function (ListingStatus) {
    ListingStatus["ACTIVE"] = "active";
    ListingStatus["PENDING"] = "pending";
    ListingStatus["SOLD"] = "sold";
    ListingStatus["EXPIRED"] = "expired";
    ListingStatus["REJECTED"] = "rejected";
})(ListingStatus || (exports.ListingStatus = ListingStatus = {}));
const marketplaceListingSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, "Listing title is required"],
        trim: true,
    },
    description: {
        type: String,
        required: [true, "Listing description is required"],
    },
    price: {
        type: Number,
        required: [true, "Price is required"],
        min: [0, "Price cannot be negative"],
    },
    negotiable: {
        type: Boolean,
        default: false,
    },
    type: {
        type: String,
        enum: Object.values(ListingType),
        required: [true, "Listing type is required"],
    },
    propertyType: {
        type: String,
        enum: Object.values(propertyModel_1.PropertyType),
        required: [true, "Property type is required"],
    },
    rejectionReason: {
        type: String,
    },
    location: {
        address: {
            type: String,
            required: [true, "Address is required"],
        },
        city: {
            type: String,
            required: [true, "City is required"],
        },
        state: {
            type: String,
            required: [true, "State is required"],
        },
        country: {
            type: String,
            required: [true, "Country is required"],
            default: "Nigeria",
        },
        coordinates: {
            latitude: Number,
            longitude: Number,
        },
    },
    features: {
        size: {
            type: Number,
            required: [true, "Size is required"],
        },
        sizeUnit: {
            type: String,
            required: [true, "Size unit is required"],
            enum: ["sqm", "sqft", "acres", "hectares"],
            default: "sqm",
        },
        bedrooms: Number,
        bathrooms: Number,
        amenities: [String],
    },
    images: [String],
    documents: [String],
    status: {
        type: String,
        enum: Object.values(ListingStatus),
        default: ListingStatus.PENDING,
    },
    seller: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    property: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Property",
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    viewCount: {
        type: Number,
        default: 0,
    },
    interestedCount: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});
// Index for search
marketplaceListingSchema.index({
    title: "text",
    "location.city": "text",
    "location.state": "text",
    description: "text",
});
const marketplaceInterestSchema = new mongoose_1.Schema({
    listing: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "MarketplaceListing",
        required: true,
    },
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    message: String,
    status: {
        type: String,
        enum: ["pending", "contacted", "rejected", "completed"],
        default: "pending",
    },
}, {
    timestamps: true,
});
exports.MarketplaceListing = mongoose_1.default.model("MarketplaceListing", marketplaceListingSchema);
exports.MarketplaceInterest = mongoose_1.default.model("MarketplaceInterest", marketplaceInterestSchema);
//# sourceMappingURL=marketplaceModel.js.map