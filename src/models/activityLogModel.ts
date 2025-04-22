import mongoose, { type Document, Schema } from "mongoose"

export interface IActivityLog extends Document {
  user: mongoose.Types.ObjectId
  action: string
  entity: string
  entityId?: mongoose.Types.ObjectId
  details?: any
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

const activityLogSchema = new Schema<IActivityLog>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  entity: {
    type: String,
    required: true,
  },
  entityId: {
    type: Schema.Types.ObjectId,
  },
  details: Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Index for faster queries
activityLogSchema.index({ user: 1, createdAt: -1 })
activityLogSchema.index({ entity: 1, entityId: 1 })
activityLogSchema.index({ action: 1 })

const ActivityLog = mongoose.model<IActivityLog>("ActivityLog", activityLogSchema)

export default ActivityLog
