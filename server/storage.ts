import crypto from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config.ts";

type ParsedImage = { bytes: Buffer; contentType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

const s3 = config.storageBucket ? new S3Client({
  region: config.storageRegion,
  endpoint: config.storageEndpoint,
  credentials: { accessKeyId: config.storageAccessKeyId, secretAccessKey: config.storageSecretAccessKey },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
}) : null;

const hasMagicBytes = (bytes: Buffer, type: ParsedImage["contentType"]) => {
  if (type === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return bytes.length > 12 && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
};

export const parseImageDataUrl = (value: unknown): ParsedImage => {
  if (typeof value !== "string") throw new Error("Image is required");
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Only JPEG, PNG and WebP images are accepted");
  const contentType = match[1] as ParsedImage["contentType"];
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > config.maxImageBytes) throw new Error(`Image must be smaller than ${Math.round(config.maxImageBytes / 1024 / 1024)} MB`);
  if (!hasMagicBytes(bytes, contentType)) throw new Error("Image contents do not match the declared type");
  return { bytes, contentType, extension: contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1] as "png" | "webp" };
};

export const uploadImage = async (prefix: string, image: ParsedImage) => {
  if (!s3 || !config.storageBucket) throw new Error("Object storage is not configured");
  const key = `${prefix}/${crypto.randomUUID()}.${image.extension}`;
  await s3.send(new PutObjectCommand({ Bucket: config.storageBucket, Key: key, Body: image.bytes, ContentType: image.contentType, CacheControl: "private, max-age=3600" }));
  return key;
};

export const signImageUrl = async (objectKey?: string | null, sourceUrl?: string | null) => {
  if (sourceUrl) return sourceUrl;
  if (!objectKey || !s3 || !config.storageBucket) return "";
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.storageBucket, Key: objectKey }), { expiresIn: 60 * 60 * 6 });
};

export const deleteImage = async (objectKey?: string | null) => {
  if (!objectKey || !s3 || !config.storageBucket) return;
  await s3.send(new DeleteObjectCommand({ Bucket: config.storageBucket, Key: objectKey }));
};

