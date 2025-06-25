import multer from "multer";
import path from "path";
import type { Request } from "express";
import { AppError } from "../utils/appError";
import { StatusCodes } from "http-status-codes";
import fs from "fs";

// Define types for multer since @types/multer is missing
type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;
interface File {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, "uploads/");
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

// File filter
const fileFilter = (req: Request, file: File, cb: FileFilterCallback) => {
  // Accept images and documents
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/msword" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Only images and documents are allowed",
        StatusCodes.BAD_REQUEST
      ) as unknown as Error,
      false
    );
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter: fileFilter as any,
  limits: {
    fileSize: 10 * 1024 * 1024, // 5MB
  },
});

// Export default for backward compatibility
export default upload;
