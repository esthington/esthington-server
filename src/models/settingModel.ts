import mongoose, { type Document, Schema } from "mongoose"

export interface ISetting extends Document {
  key: string
  value: any
  category: string
  description: string
  isPublic: boolean
  updatedBy: mongoose.Types.ObjectId
  updatedAt: Date
}

const settingSchema = new Schema<ISetting>({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  value: {
    type: Schema.Types.Mixed,
    required: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Update the updatedAt field on save
settingSchema.pre("save", function (next) {
  this.updatedAt = new Date()
  next()
})

const Setting = mongoose.model<ISetting>("Setting", settingSchema)

export default Setting
