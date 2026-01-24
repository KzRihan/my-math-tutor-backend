/**
 * Upload Middleware
 * 
 * Global Multer configuration for handling file uploads:
 * - Profile images (disk storage)
 * - OCR images (memory storage for queue processing)
 * - Generic image uploads
 */

import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { BadRequestError } from '@utils/errors';

// ============================================================
// Directory Setup
// ============================================================

const uploadsDir = path.join(process.cwd(), 'uploads');
const profileImagesDir = path.join(uploadsDir, 'profiles');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(profileImagesDir)) {
    fs.mkdirSync(profileImagesDir, { recursive: true });
}

// ============================================================
// File Filters
// ============================================================

/**
 * Standard image file filter (jpg, jpeg, png, gif, webp)
 */
const imageFileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    if (allowedMimeTypes.includes(mimeType) && allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new BadRequestError('Only image files (jpg, jpeg, png, gif, webp) are allowed') as any, false);
    }
};

/**
 * Extended image file filter for OCR (includes HEIC for iOS)
 */
const ocrImageFileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => {
    const allowedMimeTypes = [
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/webp', 
        'image/heic',
        'image/heif'
    ];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    if (allowedMimeTypes.includes(mimeType) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new BadRequestError('Invalid file type. Allowed: JPEG, PNG, WebP, HEIC') as any, false);
    }
};

// ============================================================
// Storage Configurations
// ============================================================

/**
 * Disk storage for profile images
 */
const profileStorage = multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb) => {
        cb(null, profileImagesDir);
    },
    filename: (_req: Request, file: Express.Multer.File, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `profile-${uniqueSuffix}${ext}`);
    }
});

// ============================================================
// Multer Instances
// ============================================================

/**
 * Profile image upload (disk storage)
 * - Max file size: 5MB
 * - Only standard images allowed
 */
export const uploadProfileImage = multer({
    storage: profileStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1
    }
});

/**
 * OCR image upload (memory storage for queue processing)
 * - Max file size: 10MB
 * - Includes HEIC/HEIF for iOS support
 */
export const uploadOcrImage = multer({
    storage: multer.memoryStorage(),
    fileFilter: ocrImageFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max for OCR
        files: 1
    }
});

/**
 * Generic memory storage for cloud uploads
 * - Max file size: 5MB
 * - Standard images only
 */
export const uploadToMemory = multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1
    }
});

/**
 * Create custom upload instance with configurable options
 */
export function createUploader(options: {
    storage?: 'memory' | 'disk';
    destination?: string;
    maxFileSize?: number;
    allowHeic?: boolean;
}) {
    const {
        storage = 'memory',
        destination = uploadsDir,
        maxFileSize = 5 * 1024 * 1024,
        allowHeic = false
    } = options;

    const storageConfig = storage === 'disk' 
        ? multer.diskStorage({
            destination: (_req, _file, cb) => cb(null, destination),
            filename: (_req, file, cb) => {
                const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
                const ext = path.extname(file.originalname).toLowerCase();
                cb(null, `file-${uniqueSuffix}${ext}`);
            }
        })
        : multer.memoryStorage();

    return multer({
        storage: storageConfig,
        fileFilter: allowHeic ? ocrImageFileFilter : imageFileFilter,
        limits: {
            fileSize: maxFileSize,
            files: 1
        }
    });
}

export default uploadProfileImage;

