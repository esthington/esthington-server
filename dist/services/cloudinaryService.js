"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFromCloudinary = exports.uploadToCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
const fs_1 = __importDefault(require("fs"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: config_1.default.cloudinary.cloudName,
    api_key: config_1.default.cloudinary.apiKey,
    api_secret: config_1.default.cloudinary.apiSecret,
});
/**
 * Upload file to Cloudinary
 * @param filePath Path to file
 * @param folder Folder to upload to (optional)
 */
const uploadToCloudinary = (filePath_1, ...args_1) => __awaiter(void 0, [filePath_1, ...args_1], void 0, function* (filePath, folder = "financial-dashboard") {
    try {
        // Check if Cloudinary is configured
        if (!config_1.default.cloudinary.cloudName || !config_1.default.cloudinary.apiKey || !config_1.default.cloudinary.apiSecret) {
            logger_1.default.warn("Cloudinary not configured. File will not be uploaded.");
            return { secure_url: filePath, public_id: "local_file" };
        }
        const result = yield cloudinary_1.v2.uploader.upload(filePath, {
            folder,
        });
        // Remove file from server after upload
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        return result;
    }
    catch (error) {
        // Remove file from server if upload fails
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        logger_1.default.error(`Cloudinary upload error: ${error instanceof Error ? error.message : "Unknown error"}`);
        throw error;
    }
});
exports.uploadToCloudinary = uploadToCloudinary;
/**
 * Delete file from Cloudinary
 * @param publicId Public ID of the file
 */
const deleteFromCloudinary = (publicId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Check if Cloudinary is configured
        if (!config_1.default.cloudinary.cloudName || !config_1.default.cloudinary.apiKey || !config_1.default.cloudinary.apiSecret) {
            logger_1.default.warn("Cloudinary not configured. No file will be deleted.");
            return { result: "ok" };
        }
        return yield cloudinary_1.v2.uploader.destroy(publicId);
    }
    catch (error) {
        logger_1.default.error(`Cloudinary delete error: ${error instanceof Error ? error.message : "Unknown error"}`);
        throw error;
    }
});
exports.deleteFromCloudinary = deleteFromCloudinary;
// Create a service object for modules that prefer object-style imports
const cloudinaryService = {
    uploadToCloudinary: exports.uploadToCloudinary,
    deleteFromCloudinary: exports.deleteFromCloudinary,
};
exports.default = cloudinaryService;
//# sourceMappingURL=cloudinaryService.js.map