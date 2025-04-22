import mongoose from "mongoose"
import config from "./config"
import logger from "../utils/logger"

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(config.mongoUri)
    logger.info(`MongoDB Connected: ${conn.connection.host}`)
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error instanceof Error ? error.message : "Unknown error"}`)
    process.exit(1)
  }
}

export default connectDB
