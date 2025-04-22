import mongoose, { type Document, Schema } from "mongoose"
import { PropertyType } from "./propertyModel"

export enum ListingType {
  SALE = "sale",
  RENT = "rent",
  LEASE = "lease",
}

export enum ListingStatus {
  ACTIVE = "active",
  PENDING = "pending",
  SOLD = "sold",
  EXPIRED = "expired",
  REJECTED = "rejected",
}

export interface IMarketplaceListing extends Document {
  _id: string;
  title: string;
  description: string;
  rejectionReason: string;
  price: number;
  negotiable: boolean;
  type: ListingType;
  propertyType: PropertyType;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  features: {
    size: number;
    sizeUnit: string;
    bedrooms?: number;
    bathrooms?: number;
    amenities: string[];
  };
  images: string[];
  documents: string[];
  status: ListingStatus;
  seller: mongoose.Types.ObjectId;
  property?: mongoose.Types.ObjectId;
  isVerified: boolean;
  expiresAt: Date;
  viewCount: number;
  interestedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const marketplaceListingSchema = new Schema<IMarketplaceListing>(
  {
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
      enum: Object.values(PropertyType),
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
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

// Index for search
marketplaceListingSchema.index({
  title: "text",
  "location.city": "text",
  "location.state": "text",
  description: "text",
})

export interface IMarketplaceInterest extends Document {
  listing: mongoose.Types.ObjectId
  user: mongoose.Types.ObjectId
  message?: string
  status: "pending" | "contacted" | "rejected" | "completed"
  createdAt: Date
  updatedAt: Date
}

const marketplaceInterestSchema = new Schema<IMarketplaceInterest>(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceListing",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: String,
    status: {
      type: String,
      enum: ["pending", "contacted", "rejected", "completed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
)

export const MarketplaceListing = mongoose.model<IMarketplaceListing>("MarketplaceListing", marketplaceListingSchema)
export const MarketplaceInterest = mongoose.model<IMarketplaceInterest>(
  "MarketplaceInterest",
  marketplaceInterestSchema,
)
