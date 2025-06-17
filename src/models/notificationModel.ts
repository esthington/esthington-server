import mongoose, { Schema, type Document } from "mongoose"

export enum NotificationType {
  TRANSACTION = "transaction",
  PROPERTY = "property",
  INVESTMENT = "investment",
  SECURITY = "security",
  SYSTEM = "system",
  MARKETING = "marketing",
  REFERRAL = "referral",
}

export interface INotification extends Document {
  user: mongoose.Types.ObjectId
  title: string
  message: string
  type: NotificationType
  isRead: boolean
  link?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    link: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
)

// Index for faster queries
notificationSchema.index({ user: 1, createdAt: -1 })
notificationSchema.index({ user: 1, isRead: 1 })

const Notification = mongoose.model<INotification>("Notification", notificationSchema)

export default Notification
