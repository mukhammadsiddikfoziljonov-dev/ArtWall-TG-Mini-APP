import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const numberFromEnv = (key: string, fallback: number) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const verifiedPostgresUrl = (value: string) => value.replace(/([?&])sslmode=require(?=&|$)/, "$1sslmode=verify-full");

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || process.env.API_PORT || 3001),
  appOrigin: process.env.APP_ORIGIN || "http://localhost:3000",
  databaseUrl: verifiedPostgresUrl(process.env.DATABASE_URL || ""),
  sessionSecret: process.env.SESSION_SECRET || "local-preview-only-change-me",
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  adminTelegramIds: new Set((process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((id) => id.trim()).filter(Boolean)),
  previewAuthEnabled: process.env.PREVIEW_AUTH_ENABLED === "true" && process.env.NODE_ENV !== "production",
  maxArtists: numberFromEnv("MAX_ARTISTS", 100),
  maxBuyers: numberFromEnv("MAX_BUYERS", 500),
  maxArtworksPerArtist: numberFromEnv("MAX_ARTWORKS_PER_ARTIST", 5),
  maxImageBytes: numberFromEnv("MAX_IMAGE_BYTES", 5 * 1024 * 1024),
  storageBucket: process.env.STORAGE_BUCKET || "",
  storageEndpoint: process.env.AWS_ENDPOINT_URL_S3 || "",
  storageRegion: process.env.AWS_REGION || "",
  storageAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  storageSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  leadsWebhookUrl: process.env.LEADS_WEBHOOK_URL || "",
  leadsWebhookSecret: process.env.LEADS_WEBHOOK_SECRET || "",
};

if (!config.databaseUrl) throw new Error("DATABASE_URL is required");
if (config.nodeEnv === "production" && config.sessionSecret === "local-preview-only-change-me") {
  throw new Error("A secure SESSION_SECRET is required in production");
}

