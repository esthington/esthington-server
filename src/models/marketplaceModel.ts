import mongoose, { type Document, Schema } from "mongoose";

export enum ListingStatus {
  AVAILABLE = "available",
  PENDING = "pending",
  SOLD = "sold",
  OUT_OF_STOCK = "out_of_stock",
}

export interface IMarketplaceListing extends Document {
  title: string;
  description: string;
  price: number;
  discountedPrice?: number;
  quantity: number;
  sku?: string;
  barcode?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  location: string;
  type: string;
  size?: string;
  status: "available" | "pending" | "sold" | "out_of_stock";
  featured: boolean;
  trending?: boolean;
  images: string[];
  amenities?: string[];
  createdAt: Date;
  updatedAt: Date;
  companyId: mongoose.Types.ObjectId;
  creatorId: string;
  categories?: string[];
  tags?: string[];
  isDigital?: boolean;
  downloadUrl?: string;
  variations?: Array<{
    id: string;
    name: string;
    options: Array<{
      id: string;
      name: string;
      price: number;
      discountedPrice?: number;
      quantity: number;
      sku?: string;
    }>;
  }>;
  thumbnail?: string;
  gallery?: string[];
  documents?: string[];
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
    discountedPrice: {
      type: Number,
      min: [0, "Discounted price cannot be negative"],
      validate: {
        validator: function (this: any, value: number) {
          if (!value) return true;

          // Use current document's price or fallback to update object
          const price =
            this.price ??
            this.getUpdate?.()?.price ??
            this.getUpdate?.()?.$set?.price;

          return value < price;
        },
        message: "Discounted price must be less than regular price",
      },
    },
    quantity: {
      type: Number,
      default: 1,
      min: [0, "Quantity cannot be negative"],
    },
    sku: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    weight: {
      type: Number,
      min: [0, "Weight cannot be negative"],
    },
    dimensions: {
      length: {
        type: Number,
        min: [0, "Length cannot be negative"],
      },
      width: {
        type: Number,
        min: [0, "Width cannot be negative"],
      },
      height: {
        type: Number,
        min: [0, "Height cannot be negative"],
      },
    },
    location: {
      type: String,
      required: [true, "Location is required"],
    },
    type: {
      type: String,
      required: [true, "Type is required"],
    },
    size: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(ListingStatus),
      default: ListingStatus.PENDING,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    trending: {
      type: Boolean,
      default: false,
    },
    images: [String],
    amenities: [String],
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    creatorId: {
      type: String,
      required: true,
    },
    categories: [String],
    tags: [String],
    isDigital: {
      type: Boolean,
      default: false,
    },
    downloadUrl: {
      type: String,
      validate: {
        validator: function (this: IMarketplaceListing, value: string) {
          return !this.isDigital || (this.isDigital && !!value);
        },
        message: "Download URL is required for digital products",
      },
    },
    variations: [
      {
        id: String,
        name: String,
        options: [
          {
            id: String,
            name: String,
            price: Number,
            discountedPrice: Number,
            quantity: Number,
            sku: String,
          },
        ],
      },
    ],
    thumbnail: {
      type: String,
    },
    gallery: [String],
    documents: [String],
  },
  {
    timestamps: true,
  }
);

// Middleware to auto-set status
marketplaceListingSchema.pre("save", function (next) {
  if (this.isModified("quantity") && this.quantity <= 0) {
    this.status = ListingStatus.OUT_OF_STOCK;
  }
  next();
});

// Search index
marketplaceListingSchema.index({
  title: "text",
  description: "text",
  location: "text",
});

export const MarketplaceListing = mongoose.model<IMarketplaceListing>(
  "MarketplaceListing",
  marketplaceListingSchema
);
