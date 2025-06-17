import mongoose, { type Document, Schema } from "mongoose";

export enum ListingStatus {
  AVAILABLE = "available",
  PENDING = "pending",
  SOLD = "sold",
  OUT_OF_STOCK = "out_of_stock",
}

export interface MarketplacePurchase {
  _id?: string;
  purchaseId: string;
  buyerId: mongoose.Types.ObjectId;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  purchaseDate: Date;
  transactionRef: string;
  notes?: string;
  deliveryStatus?:
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled";
  deliveryAddress?: string;
  trackingNumber?: string;
}

export interface IMarketplaceListing extends Document {
  title: string;
  description: string;
  price: number;
  discountedPrice?: number;
  originalQuantity?: number; // Made optional
  quantity: number;
  soldQuantity: number;
  reservedQuantity: number;
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
  purchases: MarketplacePurchase[];
  totalRevenue: number;
  lastSaleDate?: Date;
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
  isQuantityAvailable(requestedQuantity: number): boolean;
  getPurchasesByBuyer(buyerId: string): MarketplacePurchase[];
  reserveQuantity(quantity: number): boolean;
  releaseReservedQuantity(quantity: number): void;
  addPurchase(purchaseData: Partial<MarketplacePurchase>): void;
}

const purchaseSchema = new Schema<MarketplacePurchase>(
  {
    purchaseId: {
      type: String,
      required: [true, "Purchase ID is required"],
      trim: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Buyer ID is required"],
    },
    buyerName: {
      type: String,
      required: [true, "Buyer name is required"],
      trim: true,
    },
    buyerEmail: {
      type: String,
      required: [true, "Buyer email is required"],
      trim: true,
      lowercase: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    unitPrice: {
      type: Number,
      required: [true, "Unit price is required"],
      min: [0, "Unit price cannot be negative"],
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
    },
    purchaseDate: {
      type: Date,
      required: [true, "Purchase date is required"],
      default: Date.now,
    },
    transactionRef: {
      type: String,
      required: [true, "Transaction reference is required"],
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    deliveryStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    deliveryAddress: {
      type: String,
      trim: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

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
          const price =
            this.price ??
            this.getUpdate?.()?.price ??
            this.getUpdate?.()?.$set?.price;
          return value < price;
        },
        message: "Discounted price must be less than regular price",
      },
    },
    originalQuantity: {
      type: Number,
      required: false, // Changed from required: true to required: false
      min: [0, "Original quantity cannot be negative"],
    },
    quantity: {
      type: Number,
      required: true, // Added required: true
      min: [0, "Quantity cannot be negative"],
    },
    soldQuantity: {
      type: Number,
      default: 0,
      min: [0, "Sold quantity cannot be negative"],
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: [0, "Reserved quantity cannot be negative"],
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
    purchases: [purchaseSchema],
    totalRevenue: {
      type: Number,
      default: 0,
      min: [0, "Total revenue cannot be negative"],
    },
    lastSaleDate: {
      type: Date,
    },
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

// Index for search and performance
marketplaceListingSchema.index({
  title: "text",
  description: "text",
  location: "text",
});
marketplaceListingSchema.index({ type: 1, status: 1 });
marketplaceListingSchema.index({ companyId: 1 });
marketplaceListingSchema.index({ featured: 1, trending: 1 });
marketplaceListingSchema.index({ "purchases.buyerId": 1 });
marketplaceListingSchema.index({ createdAt: -1 });

// Pre-save middleware to update quantities and status
marketplaceListingSchema.pre("save", function (next) {
  try {
    // Set originalQuantity if it doesn't exist
    if (this.isNew && !this.originalQuantity && this.quantity) {
      this.originalQuantity = this.quantity;
    }

    if (this.purchases && this.purchases.length > 0) {
      // Recalculate quantities from purchases
      this.soldQuantity = this.purchases.reduce(
        (sum, purchase) => sum + purchase.quantity,
        0
      );

      // Update quantity based on original and sold
      if (this.originalQuantity) {
        this.quantity = Math.max(
          0,
          this.originalQuantity - this.soldQuantity - this.reservedQuantity
        );
      } else {
        // If no originalQuantity, just decrement quantity directly
        this.quantity = Math.max(0, this.quantity - this.reservedQuantity);
      }

      // Calculate total revenue
      this.totalRevenue = this.purchases.reduce(
        (sum, purchase) => sum + purchase.totalAmount,
        0
      );

      // Update last sale date
      const sortedPurchases = this.purchases.sort(
        (a, b) =>
          new Date(b.purchaseDate).getTime() -
          new Date(a.purchaseDate).getTime()
      );
      if (sortedPurchases.length > 0) {
        this.lastSaleDate = sortedPurchases[0].purchaseDate;
      }
    }

    // Update status based on availability
    if (this.quantity <= 0 && this.soldQuantity > 0) {
      this.status = ListingStatus.SOLD;
    } else if (this.quantity <= 0) {
      this.status = ListingStatus.OUT_OF_STOCK;
    } else if (this.quantity > 0) {
      this.status = ListingStatus.AVAILABLE;
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Virtual for sales rate
marketplaceListingSchema.virtual("salesRate").get(function () {
  if (!this.originalQuantity) return 0;
  return Math.round((this.soldQuantity / this.originalQuantity) * 100);
});

// Virtual for average sale price
marketplaceListingSchema.virtual("averageSalePrice").get(function () {
  if (this.soldQuantity === 0) return 0;
  return Math.round(this.totalRevenue / this.soldQuantity);
});

// Method to check if quantity is available
marketplaceListingSchema.methods.isQuantityAvailable = function (
  requestedQuantity: number
): boolean {
  return this.quantity >= requestedQuantity;
};

// Method to get purchases by buyer
marketplaceListingSchema.methods.getPurchasesByBuyer = function (
  buyerId: string
): MarketplacePurchase[] {
  return this.purchases.filter(
    (purchase: MarketplacePurchase) =>
      purchase.buyerId && purchase.buyerId.toString() === buyerId
  );
};

// Method to reserve quantity temporarily
marketplaceListingSchema.methods.reserveQuantity = function (
  quantity: number
): boolean {
  if (this.quantity >= quantity) {
    this.reservedQuantity += quantity;
    this.quantity -= quantity;
    return true;
  }
  return false;
};

// Method to release reserved quantity
marketplaceListingSchema.methods.releaseReservedQuantity = function (
  quantity: number
): void {
  const releaseAmount = Math.min(quantity, this.reservedQuantity);
  this.reservedQuantity -= releaseAmount;
  this.quantity += releaseAmount;
};

// Method to add purchase record
marketplaceListingSchema.methods.addPurchase = function (
  purchaseData: Partial<MarketplacePurchase>
): void {
  const purchase: MarketplacePurchase = {
    purchaseId:
      purchaseData.purchaseId ||
      `PUR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    buyerId: purchaseData.buyerId!,
    buyerName: purchaseData.buyerName!,
    buyerEmail: purchaseData.buyerEmail!,
    quantity: purchaseData.quantity!,
    unitPrice: purchaseData.unitPrice!,
    totalAmount: purchaseData.totalAmount!,
    purchaseDate: purchaseData.purchaseDate || new Date(),
    transactionRef: purchaseData.transactionRef!,
    notes: purchaseData.notes,
    deliveryStatus: purchaseData.deliveryStatus || "pending",
    deliveryAddress: purchaseData.deliveryAddress,
    trackingNumber: purchaseData.trackingNumber,
  };

  this.purchases.push(purchase);

  // Update quantity directly
  this.quantity = Math.max(0, this.quantity - purchase.quantity);
  this.soldQuantity += purchase.quantity;
};

export const MarketplaceListing =
  mongoose.models.MarketplaceListing ||
  mongoose.model<IMarketplaceListing>(
    "MarketplaceListing",
    marketplaceListingSchema
  );

export default MarketplaceListing;
