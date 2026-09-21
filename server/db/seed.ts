import { config as loadEnv } from "dotenv";
import { db, pool } from "./client.ts";
import { analyticsEvents, artworkMedia, artworks, users } from "./schema.ts";

loadEnv({ path: ".env.local" });
loadEnv();

const artistA = "11111111-1111-4111-8111-111111111111";
const artistB = "22222222-2222-4222-8222-222222222222";
const viewer = "33333333-3333-4333-8333-333333333333";

await db.insert(users).values([
  { id: artistA, telegramId: "seed-artist-a", name: "Mira Safina", username: "mirasafina", roles: ["buyer", "artist"], bio: "Contemporary artist exploring quiet landscapes, memory and light.", location: "Tashkent, Uzbekistan", social: "@mirasafina" },
  { id: artistB, telegramId: "seed-artist-b", name: "Anton Reyes", username: "antonreyes", roles: ["buyer", "artist"], bio: "Painter and printmaker working between abstraction and architecture.", location: "Almaty, Kazakhstan", social: "@antonreyes" },
  { id: viewer, telegramId: "seed-buyer", name: "ArtWall Collector", username: "artwall_collector", roles: ["buyer"] },
]).onConflictDoNothing();

const seedArt = [
  ["a1111111-1111-4111-8111-111111111111", artistA, "Still Morning", "Oil on canvas", 70, 90, 82000, ["abstract", "calm", "blue"], "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=88"],
  ["a2222222-2222-4222-8222-222222222222", artistB, "Terracotta City", "Acrylic on linen", 60, 80, 64000, ["modern", "warm", "city"], "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1200&q=88"],
  ["a3333333-3333-4333-8333-333333333333", artistA, "Garden After Rain", "Oil and pigment", 90, 110, 98000, ["nature", "green", "textural"], "/artworks/garden.svg"],
  ["a4444444-4444-4444-8444-444444444444", artistB, "Intervals No. 4", "Archival print", 50, 70, 57000, ["graphic", "colour", "edition"], "https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?auto=format&fit=crop&w=1200&q=88"],
  ["a5555555-5555-4555-8555-555555555555", artistA, "Distant Water", "Oil on wood", 80, 60, 76000, ["landscape", "minimal", "water"], "/artworks/distant.svg"],
  ["a6666666-6666-4666-8666-666666666666", artistB, "Soft Geometry", "Giclée print", 50, 50, 43000, ["abstract", "gradient", "edition"], "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=88"],
] as const;

for (const [id, artistId, title, medium, width, height, priceCents, tags, sourceUrl] of seedArt) {
  await db.insert(artworks).values({ id, artistId, title, description: `${title} is an original work shaped by atmosphere, texture and the subtle rhythm of everyday spaces.`, medium, year: 2026, width: String(width), height: String(height), priceCents, currency: "USD", available: true, status: "published", tags: [...tags] }).onConflictDoNothing();
  await db.insert(artworkMedia).values({ artworkId: id, sourceUrl, position: 0 }).onConflictDoNothing();
}

const eventRows = seedArt.flatMap(([artworkId], artworkIndex) => Array.from({ length: 4 + artworkIndex }, (_, index) => ({
  name: index % 3 === 0 ? "ar_started" : "artwork_opened",
  userId: index % 2 ? artistA : viewer,
  artworkId,
})));
if ((await db.select().from(analyticsEvents)).length === 0) await db.insert(analyticsEvents).values(eventRows);

console.log("Development data is ready");
await pool.end();

