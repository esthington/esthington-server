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
  createdAt: Date;
  updatedAt: Date;
}

const plotSchema = new Schema<PropertyPlot>({
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
});

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
    investmentId: {type: mongoose.Schema.Types.ObjectId, ref: "Investment"},
  },
  {
    timestamps: true,
  }
);

// Index for search
propertySchema.index({ title: "text", location: "text", description: "text" });

// Populate company details on find
propertySchema.pre(/^find/, function (next) {
  (this as mongoose.Query<any, any>).populate({
    path: "companyId",
    select: "name logo",
  });
  next();
});

// Update available plots count before save
propertySchema.pre("save", function (next) {
  if (this.plots) {
    this.availablePlots = this.plots.filter(
      (plot) => plot.status === PlotStatus.AVAILABLE
    ).length;
  }
  next();
});

const Property = mongoose.model<IProperty>("Property", propertySchema);

export default Property;
