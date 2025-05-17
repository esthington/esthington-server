import mongoose from "mongoose";
import config from "./config";
import logger from "../utils/logger";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async (app: any): Promise<void> => {
  try {
    const conn = await mongoose.connect(config.mongoUri);

    if (conn.connection.readyState === 1) {
      // Start server
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
      });
   
      logger.info(`MongoDB Connected: ${conn.connection.host}`);

    }
  } catch (error) {
    logger.error(
      `Error connecting to MongoDB: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    process.exit(1);
  }
};

export default connectDB;
