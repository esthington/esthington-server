import mongoose, { type Document, Schema } from "mongoose"

export interface IBankAccount extends Document {
  user: mongoose.Types.ObjectId
  bankName: string
  accountName: string
  accountNumber: string
  routingNumber?: string
  swiftCode?: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

const bankAccountSchema = new Schema<IBankAccount>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bankName: {
      type: String,
      required: [true, "Bank name is required"],
      trim: true,
    },
    accountName: {
      type: String,
      required: [true, "Account name is required"],
      trim: true,
    },
    accountNumber: {
      type: String,
      required: [true, "Account number is required"],
      trim: true,
    },
    routingNumber: {
      type: String,
      trim: true,
    },
    swiftCode: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Ensure only one default account per user
bankAccountSchema.pre("save", async function (next) {
  if (this.isDefault) {
    await this.model("BankAccount").updateMany({ user: this.user, _id: { $ne: this._id } }, { isDefault: false })
  }
  next()
})

const BankAccount = mongoose.model<IBankAccount>("BankAccount", bankAccountSchema)

export default BankAccount
