import mongoose, { type Document, Schema } from "mongoose";

export enum PropertyType {
  LAND = "Land",
  RESIDENTIAL = "Residential",
  COMMERCIAL = "Commercial",
}

export enum PropertyStatus {
  AVAILABLE = "Available",
  SOLD_OUT = "Sold Out",
  COMING_SOON = "Coming Soon",
}

export enum PlotStatus {
  AVAILABLE = "Available",
  RESERVED = "Reserved",
  SOLD = "Sold",
}

export interface PropertyPlot {
  _id?: string;
  plotId: string;
  size: string;
  price: number;
  status: PlotStatus;
  buyerId?: mongoose.Types.ObjectId;
  buyerName?: string;
  buyerEmail?: string;
  soldDate?: Date;
  transactionRef?: string;
  paymentId?: mongoose.Types.ObjectId; // Reference to PropertyPayment
  reservedUntil?: Date;
  coordinates?: string;
  notes?: string;
}

export interface IProperty extends Document {
  _id: string;
  title: string;
  description: string;
  location: string;
  price: number;
  plotSize: string;
  totalPlots: number;
  availablePlots: number;
  soldPlots: number;
  reservedPlots: number;
  type: PropertyType;
  status: PropertyStatus;
  featured: boolean;
  companyId: mongoose.Types.ObjectId;
  companyName?: string;
  companyLogo?: string;
  amenities: string[];
  plots: PropertyPlot[];
  thumbnail?: string;
  gallery?: string[];
  planFile?: string;
  documents?: string[];
  investmentId?: mongoose.Types.ObjectId;
  totalRevenue: number;
  lastSaleDate?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Method signatures
  isPlotAvailable(plotId: string): boolean;
  getAvailablePlots(): PropertyPlot[];
  getSoldPlots(): PropertyPlot[];
  getPlotsByBuyer(buyerId: string): PropertyPlot[];
  getPlotsByPayment(paymentId: string): PropertyPlot[];
  reservePlots(
    plotIds: string[],
    reservationMinutes?: number
  ): { success: string[]; failed: string[] };
  releaseExpiredReservations(): string[];
  recalculateStats(): void;
}

const plotSchema = new Schema<PropertyPlot>(
  {
    plotId: {
      type: String,
      required: [true, "Plot ID is required"],
      trim: true,
    },
    size: {
      type: String,
      required: [true, "Plot size is required"],
    },
    price: {
      type: Number,
      required: [true, "Plot price is required"],
      min: [0, "Price cannot be negative"],
    },
    status: {
      type: String,
      enum: Object.values(PlotStatus),
      default: PlotStatus.AVAILABLE,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    buyerName: {
      type: String,
      trim: true,
    },
    buyerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    soldDate: {
      type: Date,
    },
    transactionRef: {
      type: String,
      trim: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPayment",
    },
    reservedUntil: {
      type: Date,
    },
    coordinates: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

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
    location: {
      type: String,
      required: [true, "Property location is required"],
    },
    price: {
      type: Number,
      required: [true, "Property price is required"],
      min: [0, "Price cannot be negative"],
    },
    plotSize: {
      type: String,
      required: [true, "Plot size is required"],
    },
    totalPlots: {
      type: Number,
      required: [true, "Total plots is required"],
      min: [1, "Total plots must be at least 1"],
    },
    availablePlots: {
      type: Number,
      default: function () {
        return this.totalPlots;
      },
    },
    soldPlots: {
      type: Number,
      default: 0,
    },
    reservedPlots: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      enum: Object.values(PropertyType),
      required: [true, "Property type is required"],
    },
    status: {
      type: String,
      enum: Object.values(PropertyStatus),
      default: PropertyStatus.AVAILABLE,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company is required"],
    },
    companyName: String,
    companyLogo: String,
    amenities: [String],
    plots: [plotSchema],
    thumbnail: String,
    gallery: [String],
    planFile: String,
    documents: [String],
    investmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Investment" },
    totalRevenue: {
      type: Number,
      default: 0,
      min: [0, "Total revenue cannot be negative"],
    },
    lastSaleDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for search and performance
propertySchema.index({ title: "text", location: "text", description: "text" });
propertySchema.index({ type: 1, status: 1 });
propertySchema.index({ companyId: 1 });
propertySchema.index({ featured: 1 });
propertySchema.index({ "plots.status": 1 });
propertySchema.index({ "plots.buyerId": 1 });
propertySchema.index({ "plots.plotId": 1 });
propertySchema.index({ "plots.paymentId": 1 }); // Add index for paymentId

// Populate company details on find
propertySchema.pre(/^find/, function (next) {
  (this as mongoose.Query<any, any>).populate({
    path: "companyId",
    select: "name logo",
  });
  next();
});

// Enhanced pre-save middleware with better error handling and validation
propertySchema.pre("save", function (next) {
  try {
    // Ensure plots array exists
    if (!this.plots) {
      this.plots = [];
    }

    // Recalculate all stats
    this.recalculateStats();

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to recalculate all property statistics
propertySchema.methods.recalculateStats = function (): void {
  if (!this.plots || this.plots.length === 0) {
    this.availablePlots = this.totalPlots || 0;
    this.soldPlots = 0;
    this.reservedPlots = 0;
    this.totalRevenue = 0;
    this.status = PropertyStatus.AVAILABLE;
    return;
  }

  // Count plots by status with validation
  const availablePlots = this.plots.filter(
    (plot: PropertyPlot) => plot.status === PlotStatus.AVAILABLE
  );
  const soldPlots = this.plots.filter(
    (plot: PropertyPlot) => plot.status === PlotStatus.SOLD
  );
  const reservedPlots = this.plots.filter(
    (plot: PropertyPlot) => plot.status === PlotStatus.RESERVED
  );

  // Update counts
  this.availablePlots = availablePlots.length;
  this.soldPlots = soldPlots.length;
  this.reservedPlots = reservedPlots.length;

  // Validate total plots consistency
  const calculatedTotal =
    this.availablePlots + this.soldPlots + this.reservedPlots;
  if (calculatedTotal !== this.plots.length) {
    console.warn(
      `Plot count mismatch for property ${this._id}: calculated ${calculatedTotal}, actual ${this.plots.length}`
    );
  }

  // Update property status based on plot availability
  if (this.availablePlots === 0 && this.soldPlots > 0) {
    this.status = PropertyStatus.SOLD_OUT;
  } else if (this.availablePlots > 0) {
    this.status = PropertyStatus.AVAILABLE;
  } else if (this.soldPlots === 0 && this.reservedPlots === 0) {
    this.status = PropertyStatus.COMING_SOON;
  }

  // Calculate total revenue from sold plots with validation
  this.totalRevenue = soldPlots.reduce((sum: number, plot: PropertyPlot) => {
    const price = Number(plot.price) || 0;
    if (price < 0) {
      console.warn(`Negative price detected for plot ${plot.plotId}: ${price}`);
      return sum;
    }
    return sum + price;
  }, 0);

  // Update last sale date from the most recent sold plot
  const soldPlotsWithDates = soldPlots.filter(
    (plot: PropertyPlot) => plot.status === PlotStatus.SOLD && plot.soldDate
  );

  if (soldPlotsWithDates.length > 0) {
    this.lastSaleDate = soldPlotsWithDates.reduce(
      (latest: Date | undefined, plot: PropertyPlot) => {
        if (!latest && plot.soldDate) {
          return plot.soldDate;
        }
        if (plot.soldDate && latest && plot.soldDate > latest) {
          return plot.soldDate;
        }
        return latest;
      },
      undefined as Date | undefined
    );
  }
};

// Virtual for occupancy rate
propertySchema.virtual("occupancyRate").get(function () {
  if (this.totalPlots === 0) return 0;
  return Math.round(
    ((this.soldPlots + this.reservedPlots) / this.totalPlots) * 100
  );
});

// Virtual for revenue per plot
propertySchema.virtual("averageRevenuePerPlot").get(function () {
  if (this.soldPlots === 0) return 0;
  return Math.round(this.totalRevenue / this.soldPlots);
});

// Virtual for availability percentage
propertySchema.virtual("availabilityRate").get(function () {
  if (this.totalPlots === 0) return 0;
  return Math.round((this.availablePlots / this.totalPlots) * 100);
});

// Method to check if a plot is available for purchase
propertySchema.methods.isPlotAvailable = function (plotId: string): boolean {
  const plot = this.plots.find((p: PropertyPlot) => p.plotId === plotId);
  return plot ? plot.status === PlotStatus.AVAILABLE : false;
};

// Method to get available plots
propertySchema.methods.getAvailablePlots = function (): PropertyPlot[] {
  return this.plots.filter(
    (plot: PropertyPlot) => plot.status === PlotStatus.AVAILABLE
  );
};

// Method to get sold plots
propertySchema.methods.getSoldPlots = function (): PropertyPlot[] {
  return this.plots.filter(
    (plot: PropertyPlot) => plot.status === PlotStatus.SOLD
  );
};

// Method to get reserved plots
propertySchema.methods.getReservedPlots = function (): PropertyPlot[] {
  return this.plots.filter(
    (plot: PropertyPlot) => plot.status === PlotStatus.RESERVED
  );
};

// Method to get plots by buyer
propertySchema.methods.getPlotsByBuyer = function (
  buyerId: string
): PropertyPlot[] {
  return this.plots.filter(
    (plot: PropertyPlot) => plot.buyerId && plot.buyerId.toString() === buyerId
  );
};

// Method to get plots by payment
propertySchema.methods.getPlotsByPayment = function (
  paymentId: string
): PropertyPlot[] {
  return this.plots.filter(
    (plot: PropertyPlot) =>
      plot.paymentId && plot.paymentId.toString() === paymentId
  );
};

// Method to reserve plots temporarily with validation
propertySchema.methods.reservePlots = function (
  plotIds: string[],
  reservationMinutes = 15
): { success: string[]; failed: string[] } {
  const reservedUntil = new Date(Date.now() + reservationMinutes * 60 * 1000);
  const success: string[] = [];
  const failed: string[] = [];

  plotIds.forEach((plotId) => {
    const plot = this.plots.find((p: PropertyPlot) => p.plotId === plotId);
    if (plot && plot.status === PlotStatus.AVAILABLE) {
      plot.status = PlotStatus.RESERVED;
      plot.reservedUntil = reservedUntil;
      success.push(plotId);
    } else {
      failed.push(plotId);
    }
  });

  // Recalculate stats after reservation
  this.recalculateStats();

  return { success, failed };
};

// Method to release expired reservations
propertySchema.methods.releaseExpiredReservations = function (): string[] {
  const now = new Date();
  const releasedPlots: string[] = [];

  this.plots.forEach((plot: PropertyPlot) => {
    if (
      plot.status === PlotStatus.RESERVED &&
      plot.reservedUntil &&
      plot.reservedUntil < now
    ) {
      plot.status = PlotStatus.AVAILABLE;
      plot.reservedUntil = undefined;
      releasedPlots.push(plot.plotId);
    }
  });

  // Recalculate stats after releasing reservations
  if (releasedPlots.length > 0) {
    this.recalculateStats();
  }

  return releasedPlots;
};

// Method to validate plot data integrity
propertySchema.methods.validatePlotIntegrity = function (): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for duplicate plot IDs
  const plotIds = this.plots.map((plot: PropertyPlot) => plot.plotId);
  const uniquePlotIds = new Set(plotIds);
  if (plotIds.length !== uniquePlotIds.size) {
    errors.push("Duplicate plot IDs found");
  }

  // Check for invalid plot statuses
  this.plots.forEach((plot: PropertyPlot) => {
    if (!Object.values(PlotStatus).includes(plot.status)) {
      errors.push(`Invalid status for plot ${plot.plotId}: ${plot.status}`);
    }

    // Check sold plots have required buyer information
    if (plot.status === PlotStatus.SOLD) {
      if (!plot.buyerId) {
        errors.push(`Sold plot ${plot.plotId} missing buyer ID`);
      }
      if (!plot.soldDate) {
        errors.push(`Sold plot ${plot.plotId} missing sold date`);
      }
      if (!plot.paymentId) {
        errors.push(`Sold plot ${plot.plotId} missing payment ID`);
      }
    }

    // Check reserved plots have expiration date
    if (plot.status === PlotStatus.RESERVED && !plot.reservedUntil) {
      errors.push(
        `Reserved plot ${plot.plotId} missing reservation expiration`
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const Property =
  mongoose.models.Property ||
  mongoose.model<IProperty>("Property", propertySchema);

export default Property;
