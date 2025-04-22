import mongoose, { type Document, Schema } from "mongoose"

interface IMessage {
  sender: mongoose.Types.ObjectId
  message: string
  attachments?: string[]
  createdAt: Date
}

export interface ISupportTicket extends Document {
  user: mongoose.Types.ObjectId
  subject: string
  category: "account" | "payment" | "property" | "investment" | "technical" | "other"
  status: "open" | "in-progress" | "resolved" | "closed"
  priority: "low" | "medium" | "high" | "urgent"
  messages: IMessage[]
  assignedTo?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
  closedAt?: Date
  closedBy?: mongoose.Types.ObjectId
}

const messageSchema = new Schema<IMessage>({
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  attachments: [String],
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const supportTicketSchema = new Schema<ISupportTicket>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ["account", "payment", "property", "investment", "technical", "other"],
    required: true,
  },
  status: {
    type: String,
    enum: ["open", "in-progress", "resolved", "closed"],
    default: "open",
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  },
  messages: [messageSchema],
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  closedAt: Date,
  closedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
})

// Update the updatedAt field on save
supportTicketSchema.pre("save", function (next) {
  this.updatedAt = new Date()
  next()
})

const SupportTicket = mongoose.model<ISupportTicket>("SupportTicket", supportTicketSchema)

export default SupportTicket
