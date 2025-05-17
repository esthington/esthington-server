import mongoose, { type Document, Schema } from "mongoose";

export interface ICompany extends Document {
  _id: string;
  name: string;
  description: string;
  logo: string;
  website?: string;
  email: string;
  phone?: string;
  address?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      required: [true, "Company description is required"],
    },
    logo: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Company email is required"],
      trim: true,
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for search
companySchema.index({ name: "text", email: "text", description: "text" });

const Company = mongoose.model<ICompany>("Company", companySchema);

export default Company;
