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
exports.PropertyStatus = exports.PropertyType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var PropertyType;
(function (PropertyType) {
    PropertyType["LAND"] = "land";
    PropertyType["HOUSE"] = "house";
    PropertyType["APARTMENT"] = "apartment";
    PropertyType["COMMERCIAL"] = "commercial";
})(PropertyType || (exports.PropertyType = PropertyType = {}));
var PropertyStatus;
(function (PropertyStatus) {
    PropertyStatus["AVAILABLE"] = "available";
    PropertyStatus["SOLD"] = "sold";
    PropertyStatus["PENDING"] = "pending";
    PropertyStatus["RESERVED"] = "reserved";
})(PropertyStatus || (exports.PropertyStatus = PropertyStatus = {}));
const propertySchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, "Property title is required"],
        trim: true,
    },
    description: {
        type: String,
        required: [true, "Property description is required"],
    },
    rejectionReason: {
        type: String,
    },
    type: {
        type: String,
        enum: Object.values(PropertyType),
        required: [true, "Property type is required"],
    },
    price: {
        type: Number,
        required: [true, "Property price is required"],
        min: [0, "Price cannot be negative"],
    },
    location: {
        address: {
            type: String,
            required: [true, "Property address is required"],
        },
        city: {
            type: String,
            required: [true, "Property city is required"],
        },
        state: {
            type: String,
            required: [true, "Property state is required"],
        },
        country: {
            type: String,
            required: [true, "Property country is required"],
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
            required: [true, "Property size is required"],
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
        enum: Object.values(PropertyStatus),
        default: PropertyStatus.AVAILABLE,
    },
    owner: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isPublished: {
        type: Boolean,
        default: false,
    },
    publishedAt: Date,
    soldAt: Date,
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
propertySchema.index({ title: "text", "location.city": "text", "location.state": "text", description: "text" });
const Property = mongoose_1.default.model("Property", propertySchema);
exports.default = Property;
//# sourceMappingURL=propertyModel.js.map