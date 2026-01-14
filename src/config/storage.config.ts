import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

// Initialize Google Cloud Storage with absolute path
const keyFilename = path.join(process.cwd(), 'gcs-service-account.json');

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID || 'generique-450417',
  keyFilename: keyFilename,
});

const bucketName = process.env.GCS_BUCKET_NAME || 'stock_clients';
const bucket = storage.bucket(bucketName);

// Multer configuration for memory storage
const multerStorage = multer.memoryStorage();

// File filter for PDFs and images
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and image files (JPEG, PNG, WebP, GIF) are allowed'));
  }
};

// Multer upload configuration
export const upload = multer({
  storage: multerStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Upload file to GCS
export const uploadToGCS = async (
  file: Express.Multer.File,
  folder: string = 'menus'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${crypto.randomBytes(16).toString('hex')}${fileExtension}`;

    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
        },
      },
    });

    blobStream.on('error', (err) => {
      reject(err);
    });

    blobStream.on('finish', async () => {
      // Get public URL (bucket already has public access configured)
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};

// Delete file from GCS
export const deleteFromGCS = async (fileUrl: string): Promise<void> => {
  try {
    // Extract filename from URL
    const fileName = fileUrl.split(`${bucketName}/`)[1];
    if (!fileName) {
      throw new Error('Invalid file URL');
    }

    const file = bucket.file(fileName);
    await file.delete();
  } catch (error) {
    console.error('Error deleting file from GCS:', error);
    throw error;
  }
};
