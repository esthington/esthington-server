import { v2 as cloudinary } from "cloudinary"
import fs from "fs"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Upload file to Cloudinary
export const uploadToCloudinary = async (filePath: string) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "financial-dashboard",
    })

    // Remove file from server after upload
    fs.unlinkSync(filePath)

    return result
  } catch (error) {
    // Remove file from server if upload fails
    fs.unlinkSync(filePath)
    throw error
  }
}

// Delete file from Cloudinary
export const deleteFromCloudinary = async (publicId: string) => {
  try {
    return await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    throw error
  }
}
