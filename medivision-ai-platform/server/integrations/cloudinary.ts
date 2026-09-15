import { v2 as cloudinary } from "cloudinary";

const configured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function isCloudinaryConfigured() {
  return configured;
}

export async function uploadXray(buffer: Buffer, fileName: string, ownerOpenId: string, mimeType: string) {
  if (!configured) throw new Error("Cloudinary is not configured");
  const folder = `medivision/xrays/${ownerOpenId}`;
  return new Promise<{ publicId: string; secureUrl: string; bytes: number }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image", type: "upload", public_id: fileName.replace(/\.[^.]+$/, "") }, (error, result) => {
      if (error || !result) return reject(error || new Error("Cloudinary upload returned no result"));
      resolve({ publicId: result.public_id, secureUrl: result.secure_url, bytes: result.bytes || buffer.length });
    });
    stream.end(buffer);
  });
}

export async function uploadDerivedImage(buffer: Buffer, publicId: string) {
  if (!configured) throw new Error("Cloudinary is not configured");
  return new Promise<{ secureUrl: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "medivision/derived", public_id: publicId, resource_type: "image", overwrite: true }, (error, result) => {
      if (error || !result) return reject(error || new Error("Cloudinary derived upload failed"));
      resolve({ secureUrl: result.secure_url });
    });
    stream.end(buffer);
  });
}

export { cloudinary };
