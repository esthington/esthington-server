import mongoose, { type Document, Schema } from "mongoose"

export enum PropertyType {
  LAND = "land",
  HOUSE = "house",
  APARTMENT = "apartment",
  COMMERCIAL = "commercial",
}

export enum PropertyStatus {
  AVAILABLE = "available",
  SOLD = "sold",
  PENDING = "pending",
  RESERVED = "reserved",
}

export interface IProperty extends Document {
  _id: string;
  title: string;
  description: string;
  rejectionReason: string;
  type: PropertyType;
  price: number;
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
  status: PropertyStatus;
  owner: mongoose.Types.ObjectId;
  isVerified: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  soldAt?: Date;
  viewCount: number;
  interestedCount: number;
}

const propertySchema = new Schema<IProperty>(
  {
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
      type: mongoose.Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

// Index for search
propertySchema.index({ title: "text", "location.city": "text", "location.state": "text", description: "text" })

const Property = mongoose.model<IProperty>("Property", propertySchema)

export default Property
