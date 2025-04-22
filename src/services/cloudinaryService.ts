import { v2 as cloudinary } from "cloudinary"
import fs from "fs"
import config from "../config/config"
import logger from "../utils/logger"

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
})

/**
 * Upload file to Cloudinary
 * @param filePath Path to file
 * @param folder Folder to upload to (optional)
 */
export const uploadToCloudinary = async (filePath: string, folder = "financial-dashboard") => {
  try {
    // Check if Cloudinary is configured
    if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
      logger.warn("Cloudinary not configured. File will not be uploaded.")
      return { secure_url: filePath, public_id: "local_file" }
    }

    const result = await cloudinary.uploader.upload(filePath, {
      folder,
    })

    // Remove file from server after upload
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    return result
  } catch (error) {
    // Remove file from server if upload fails
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    logger.error(`Cloudinary upload error: ${error instanceof Error ? error.message : "Unknown error"}`)
    throw error
  }
}

/**
 * Delete file from Cloudinary
 * @param publicId Public ID of the file
 */
export const deleteFromCloudinary = async (publicId: string) => {
  try {
    // Check if Cloudinary is configured
    if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
      logger.warn("Cloudinary not configured. No file will be deleted.")
      return { result: "ok" }
    }

    return await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    logger.error(`Cloudinary delete error: ${error instanceof Error ? error.message : "Unknown error"}`)
    throw error
  }
}

// Create a service object for modules that prefer object-style imports
const cloudinaryService = {
  uploadToCloudinary,
  deleteFromCloudinary,
}

export default cloudinaryService
