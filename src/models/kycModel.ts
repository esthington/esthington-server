import mongoose, { type Document, Schema } from "mongoose"

export interface IKYC extends Document {
  _id: string
  user: mongoose.Types.ObjectId
  status: "pending" | "approved" | "rejected"
  idType: "passport" | "nationalId" | "driverLicense"
  idNumber: string
  idImage: string
  selfieImage: string
  addressProofType: "utilityBill" | "bankStatement" | "rentalAgreement"
  addressProofImage: string
  rejectionReason?: string
  submittedAt: Date
  updatedAt: Date
  verifiedBy?: mongoose.Types.ObjectId
  verifiedAt?: Date
}

const kycSchema = new Schema<IKYC>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  idType: {
    type: String,
    enum: ["passport", "nationalId", "driverLicense"],
    required: true,
  },
  idNumber: {
    type: String,
    required: true,
  },
  idImage: {
    type: String,
    required: true,
  },
  selfieImage: {
    type: String,
    required: true,
  },
  addressProofType: {
    type: String,
    enum: ["utilityBill", "bankStatement", "rentalAgreement"],
    required: true,
  },
  addressProofImage: {
    type: String,
    required: true,
  },
  rejectionReason: String,
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  verifiedAt: Date,
})

// Update the updatedAt field on save
kycSchema.pre("save", function (next) {
  this.updatedAt = new Date()
  next()
})

const KYC = mongoose.model<IKYC>("KYC", kycSchema)

export default KYC
