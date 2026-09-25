import crypto from "node:crypto";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { config } from "./config.ts";
import { db, pool } from "./db/client.ts";
import { analyticsEvents, artworkMedia, artworks, basketItems, likes, savedViews, users } from "./db/schema.ts";
import { deleteImage, parseImageDataUrl, signImageUrl, uploadImage } from "./storage.ts";
import type { AnalyticsEventName, Artwork, PlatformState, Role, SavedView, User } from "../src/types.ts";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], imgSrc: ["'self'", "data:", "blob:", "https:"], mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "https:"], scriptSrc: ["'self'", "https://telegram.org"], frameAncestors: ["'self'", "https://web.telegram.org"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(express.json({ limit: "8mb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: "draft-8", legacyHeaders: false }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: "draft-8", legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
const allowedEvents: AnalyticsEventName[] = ["artwork_impression", "artwork_opened", "artwork_liked", "basket_added", "basket_removed", "ar_started", "ar_camera_started", "ar_view_saved", "ar_view_shared", "signup_completed", "artist_profile_opened"];

type SessionPayload = { userId: string; exp: number };
type DbUser = typeof users.$inferSelect;
type AuthedRequest = Request & { user?: DbUser };

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const toUser = (user: DbUser, exposeTelegramId = true): User => ({
  id: user.id, telegramId: exposeTelegramId && user.source === "telegram" ? user.telegramId : "", source: user.source as User["source"], name: user.name,
  username: user.username || undefined, avatarUrl: user.avatarUrl || undefined, phone: exposeTelegramId ? user.phone || undefined : undefined, roles: user.roles as Role[],
  bio: user.bio || undefined, location: user.location || undefined, social: user.social || undefined, createdAt: user.createdAt.toISOString(),
  consentAt: user.consentAt?.toISOString(), onboardingCompletedAt: user.onboardingCompletedAt?.toISOString(),
});

const signSession = (payload: SessionPayload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", config.sessionSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};

const readSession = (token: string): SessionPayload | null => {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac("sha256", config.sessionSecret).update(encoded).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
};

const issueSession = (user: DbUser) => ({ token: signSession({ userId: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 }), user: toUser(user) });

const auth = async (request: AuthedRequest, _response: Response, next: NextFunction) => {
  try {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    const session = token ? readSession(token) : null;
    if (!session) throw new HttpError(401, "Authentication required");
    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) throw new HttpError(401, "Authentication required");
    request.user = user;
    next();
  } catch (error) { next(error); }
};

const onboarded = (request: AuthedRequest, _response: Response, next: NextFunction) => {
  if (!request.user?.onboardingCompletedAt) return next(new HttpError(403, "Complete signup to unlock the AR demo"));
  next();
};

const validateTelegramInitData = (initData: string) => {
  if (!config.botToken) throw new HttpError(503, "Telegram authentication is not configured yet");
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new HttpError(401, "Missing Telegram signature");
  params.delete("hash");
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > 900) throw new HttpError(401, "Telegram session is expired");
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(config.botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (receivedHash.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(receivedHash, "hex"), Buffer.from(expected, "hex"))) throw new HttpError(401, "Invalid Telegram signature");
  const rawUser = params.get("user");
  if (!rawUser) throw new HttpError(401, "Telegram user is missing");
  return JSON.parse(rawUser) as { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string };
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const countRole = async (transaction: Transaction, role: "artist" | "buyer") => {
  const condition = role === "artist" ? sql`${role} = ANY(${users.roles})` : sql`NOT ('artist' = ANY(${users.roles}))`;
  const [result] = await transaction.select({ value: count() }).from(users).where(and(condition, isNotNull(users.onboardingCompletedAt)));
  return Number(result.value);
};

const createTelegramUser = async (telegram: ReturnType<typeof validateTelegramInitData>) => db.transaction(async (tx) => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(87421001)`);
  const telegramId = String(telegram.id);
  const isAdmin = config.adminTelegramIds.has(telegramId);
  const [existing] = await tx.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
  const name = [telegram.first_name, telegram.last_name].filter(Boolean).join(" ");
  if (existing) {
    const roles: Role[] = isAdmin ? [...new Set([...existing.roles, "buyer", "artist", "admin"])] as Role[] : existing.roles as Role[];
    const [updated] = await tx.update(users).set({ name: existing.onboardingCompletedAt ? existing.name : name, username: telegram.username, avatarUrl: telegram.photo_url, roles, source: "telegram", updatedAt: new Date() }).where(eq(users.id, existing.id)).returning();
    return updated;
  }
  const roles: Role[] = isAdmin ? ["buyer", "artist", "admin"] : ["buyer"];
  const [created] = await tx.insert(users).values({ telegramId, source: "telegram", name, username: telegram.username, avatarUrl: telegram.photo_url, roles }).returning();
  return created;
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(25).regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number"),
  role: z.enum(["buyer", "artist"]),
  consent: z.literal(true, { error: "Consent is required" }),
}).strict();

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(), bio: z.string().trim().max(600).optional(),
  phone: z.string().trim().min(7).max(25).regex(/^[+0-9()\-\s]+$/).optional(),
  location: z.string().trim().max(120).optional(), social: z.string().trim().max(120).optional(), avatarUrl: z.string().url().max(2000).optional(),
}).strict();

const artworkSchema = z.object({
  title: z.string().trim().min(1).max(120), description: z.string().trim().max(3000).default(""), medium: z.string().trim().min(1).max(120),
  year: z.number().int().min(1000).max(3000), width: z.number().positive().max(1000), height: z.number().positive().max(1000),
  price: z.number().nonnegative().max(10_000_000), currency: z.string().trim().regex(/^[A-Z]{3}$/).default("USD"), available: z.boolean().default(true),
  status: z.enum(["draft", "published"]), images: z.array(z.string()).length(1), tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
}).strict();
const artworkPatchSchema = artworkSchema.omit({ images: true }).partial().strict();
const eventSchema = z.object({ name: z.enum(allowedEvents as [AnalyticsEventName, ...AnalyticsEventName[]]), artworkId: z.string().uuid().optional() }).strict();

const syncLeadToSheet = async (user: DbUser) => {
  if (!config.leadsWebhookUrl || !config.leadsWebhookSecret || !user.onboardingCompletedAt) return false;
  const eventRows = await db.select({ name: analyticsEvents.name, createdAt: analyticsEvents.createdAt }).from(analyticsEvents).where(eq(analyticsEvents.userId, user.id));
  const countEvent = (name: AnalyticsEventName) => eventRows.filter((event) => event.name === name).length;
  const lastActivity = eventRows.reduce((latest, event) => event.createdAt > latest ? event.createdAt : latest, user.updatedAt);
  const response = await fetch(config.leadsWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: config.leadsWebhookSecret,
      signupTime: user.onboardingCompletedAt.toISOString(),
      userId: user.id,
      source: user.source,
      telegramId: user.source === "telegram" ? user.telegramId : "",
      telegramUsername: user.username || "",
      fullName: user.name,
      phone: user.phone || "",
      role: user.roles.includes("artist") ? "artist" : "buyer",
      consent: user.consentAt ? "yes" : "no",
      arDemoOpens: countEvent("ar_started"),
      cameraStarts: countEvent("ar_camera_started"),
      viewsSaved: countEvent("ar_view_saved"),
      shares: countEvent("ar_view_shared"),
      lastActivity: lastActivity.toISOString(),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Lead Sheet webhook returned ${response.status}`);
  const result = await response.json().catch(() => ({ ok: false }));
  if (!result.ok) throw new Error("Lead Sheet webhook rejected the update");
  return true;
};

const refreshLeadSheet = async (userId: string) => {
  if (!config.leadsWebhookUrl) return;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user) await syncLeadToSheet(user);
};

const getState = async (current: DbUser): Promise<PlatformState> => {
  const admin = current.roles.includes("admin");
  const [userRows, artworkRows, mediaRows, likeRows, basketRows, viewRows, eventRows] = await Promise.all([
    db.select().from(users).orderBy(asc(users.createdAt)), db.select().from(artworks).orderBy(desc(artworks.createdAt)), db.select().from(artworkMedia).orderBy(asc(artworkMedia.position)),
    db.select().from(likes), db.select().from(basketItems), db.select().from(savedViews).orderBy(desc(savedViews.createdAt)), db.select().from(analyticsEvents),
  ]);
  const visibleArtworkRows = artworkRows.filter((artwork) => admin || artwork.status === "published" || artwork.artistId === current.id);
  const userById = new Map(userRows.map((user) => [user.id, user]));
  const mediaByArtwork = new Map<string, typeof mediaRows>();
  for (const media of mediaRows) mediaByArtwork.set(media.artworkId, [...(mediaByArtwork.get(media.artworkId) || []), media]);
  const artworkDtos: Artwork[] = await Promise.all(visibleArtworkRows.map(async (artwork) => {
    const artworkLikes = likeRows.filter((like) => like.artworkId === artwork.id);
    const artworkBaskets = basketRows.filter((item) => item.artworkId === artwork.id);
    const artworkEvents = eventRows.filter((event) => event.artworkId === artwork.id);
    const opened = artworkEvents.filter((event) => event.name === "artwork_opened");
    const media = mediaByArtwork.get(artwork.id) || [];
    return {
      id: artwork.id, artistId: artwork.artistId, artistName: userById.get(artwork.artistId)?.name || "Artist", title: artwork.title, description: artwork.description,
      medium: artwork.medium, year: artwork.year, width: Number(artwork.width), height: Number(artwork.height), price: artwork.priceCents / 100, currency: artwork.currency,
      available: artwork.available, status: artwork.status as Artwork["status"], images: await Promise.all(media.map((item) => signImageUrl(item.objectKey, item.sourceUrl))),
      tags: artwork.tags, createdAt: artwork.createdAt.toISOString(), stats: {
        views: opened.length, uniqueViewers: [...new Set(opened.map((event) => event.userId))], likes: artworkLikes.length, basketAdds: artworkBaskets.length,
        arTries: artworkEvents.filter((event) => event.name === "ar_started").length, shares: artworkEvents.filter((event) => event.name === "ar_view_shared").length,
      },
    };
  }));
  const scopedLikes = admin ? likeRows : likeRows.filter((like) => like.userId === current.id);
  const scopedBaskets = admin ? basketRows : basketRows.filter((item) => item.userId === current.id);
  const likesState: Record<string, string[]> = {};
  for (const item of scopedLikes) (likesState[item.userId] ||= []).push(item.artworkId);
  const basketsState: PlatformState["baskets"] = {};
  for (const item of scopedBaskets) (basketsState[item.userId] ||= []).push({ artworkId: item.artworkId, quantity: item.quantity });
  const scopedViews = admin ? viewRows : viewRows.filter((view) => view.userId === current.id);
  const viewDtos: SavedView[] = await Promise.all(scopedViews.map(async (view) => ({ id: view.id, userId: view.userId, artworkId: view.artworkId, imageDataUrl: await signImageUrl(view.objectKey, view.sourceUrl), createdAt: view.createdAt.toISOString() })));
  return {
    users: userRows.filter((user) => admin || user.id === current.id || user.roles.includes("artist")).map((user) => toUser(user, admin || user.id === current.id)),
    artworks: artworkDtos, likes: likesState, baskets: basketsState, savedViews: viewDtos,
    events: (admin ? eventRows : eventRows.filter((event) => event.userId === current.id)).map((event) => ({ id: event.id, name: event.name as AnalyticsEventName, userId: event.userId, artworkId: event.artworkId || undefined, createdAt: event.createdAt.toISOString() })),
  };
};

app.get("/api/health", async (_request, response, next) => { try { await pool.query("SELECT 1"); response.json({ ok: true, database: "connected", environment: config.nodeEnv }); } catch (error) { next(error); } });

app.post("/api/auth/telegram", authLimiter, async (request, response, next) => {
  try {
    const telegram = validateTelegramInitData(String(request.body.initData || ""));
    response.json(issueSession(await createTelegramUser(telegram)));
  } catch (error) { next(error); }
});

app.post("/api/auth/visitor", authLimiter, async (request, response, next) => {
  try {
    const visitorId = z.string().uuid().parse(request.body.visitorId);
    const telegramId = `web:${visitorId}`;
    const [user] = await db.insert(users).values({ telegramId, source: "web", name: "New visitor", roles: ["buyer"] })
      .onConflictDoUpdate({ target: users.telegramId, set: { updatedAt: new Date() } }).returning();
    response.json(issueSession(user));
  } catch (error) { next(error); }
});

app.post("/api/auth/preview", authLimiter, async (request, response, next) => {
  try {
    if (!config.previewAuthEnabled) throw new HttpError(404, "Not found");
    const role = (["buyer", "artist", "admin"].includes(request.body.role) ? request.body.role : "buyer") as Role;
    const id = `preview-${role}`;
    const roles: Role[] = role === "admin" ? ["buyer", "artist", "admin"] : role === "artist" ? ["buyer", "artist"] : ["buyer"];
    const [user] = await db.insert(users).values({ telegramId: id, source: "preview", name: role === "admin" ? "ArtWall Admin" : role === "artist" ? "Demo Artist" : "Telegram Buyer", username: id, roles, bio: role !== "buyer" ? "Contemporary artist building a collection on ArtWall." : undefined, location: role !== "buyer" ? "Tashkent, Uzbekistan" : undefined }).onConflictDoUpdate({ target: users.telegramId, set: { roles, updatedAt: new Date() } }).returning();
    response.json(issueSession(user));
  } catch (error) { next(error); }
});

app.get("/api/bootstrap", auth, async (request: AuthedRequest, response, next) => { try { response.json({ user: toUser(request.user!), state: await getState(request.user!) }); } catch (error) { next(error); } });

app.post("/api/signup", auth, async (request: AuthedRequest, response, next) => {
  try {
    const input = signupSchema.parse(request.body);
    const user = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(87421003)`);
      const [current] = await tx.select().from(users).where(eq(users.id, request.user!.id)).limit(1);
      if (!current) throw new HttpError(404, "User not found");
      if (current.onboardingCompletedAt) return current;
      const isAdmin = current.roles.includes("admin");
      if (input.role === "artist" && !isAdmin && await countRole(tx, "artist") >= config.maxArtists) throw new HttpError(409, "The artist beta is full");
      if (input.role === "buyer" && await countRole(tx, "buyer") >= config.maxBuyers) throw new HttpError(409, "The buyer beta is full");
      const roles: Role[] = input.role === "artist" ? ["buyer", "artist", ...(isAdmin ? ["admin" as const] : [])] : ["buyer", ...(isAdmin ? ["admin" as const] : [])];
      const now = new Date();
      const [updated] = await tx.update(users).set({ name: input.name, phone: input.phone, roles, consentAt: now, onboardingCompletedAt: now, updatedAt: now }).where(eq(users.id, current.id)).returning();
      await tx.insert(analyticsEvents).values({ name: "signup_completed", userId: updated.id, metadata: { role: input.role, source: updated.source } });
      return updated;
    });
    let sheetSynced = false;
    try { sheetSynced = await syncLeadToSheet(user); } catch (error) { console.error("Lead Sheet sync failed", error); }
    response.json({ user: toUser(user), sheetSynced });
  } catch (error) { next(error); }
});

app.patch("/api/profile", auth, async (request: AuthedRequest, response, next) => {
  try { const values = profileSchema.parse(request.body); const [user] = await db.update(users).set({ ...values, updatedAt: new Date() }).where(eq(users.id, request.user!.id)).returning(); void syncLeadToSheet(user).catch(console.error); response.json(toUser(user)); } catch (error) { next(error); }
});

app.post("/api/profile/role", auth, async (request: AuthedRequest, response, next) => {
  try {
    const requestedRole = z.enum(["buyer", "artist"]).parse(request.body.role);
    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(87421002)`);
      const [current] = await tx.select().from(users).where(eq(users.id, request.user!.id)).limit(1);
      if (!current) throw new HttpError(404, "User not found");
      const isAdmin = current.roles.includes("admin");
      if (requestedRole === "artist" && !current.roles.includes("artist") && await countRole(tx, "artist") >= config.maxArtists) throw new HttpError(409, "The artist beta is full");
      if (requestedRole === "buyer" && current.roles.includes("artist") && await countRole(tx, "buyer") >= config.maxBuyers) throw new HttpError(409, "The buyer beta is full");
      const roles: Role[] = requestedRole === "artist" ? ["buyer", "artist", ...(isAdmin ? ["admin" as const] : [])] : ["buyer", ...(isAdmin ? ["admin" as const] : [])];
      const [user] = await tx.update(users).set({ roles, updatedAt: new Date() }).where(eq(users.id, current.id)).returning();
      return user;
    });
    void syncLeadToSheet(updated).catch(console.error);
    response.json(toUser(updated));
  } catch (error) { next(error); }
});

app.post("/api/likes/:artworkId/toggle", auth, onboarded, async (request: AuthedRequest, response, next) => {
  try {
    const artworkId = z.string().uuid().parse(request.params.artworkId);
    const [artwork] = await db.select({ id: artworks.id }).from(artworks).where(eq(artworks.id, artworkId)).limit(1);
    if (!artwork) throw new HttpError(404, "Artwork not found");
    const [existing] = await db.select().from(likes).where(and(eq(likes.userId, request.user!.id), eq(likes.artworkId, artworkId))).limit(1);
    if (existing) await db.delete(likes).where(and(eq(likes.userId, request.user!.id), eq(likes.artworkId, artworkId)));
    else await db.transaction(async (tx) => { await tx.insert(likes).values({ userId: request.user!.id, artworkId }).onConflictDoNothing(); await tx.insert(analyticsEvents).values({ name: "artwork_liked", userId: request.user!.id, artworkId }); });
    const [total] = await db.select({ value: count() }).from(likes).where(eq(likes.artworkId, artworkId));
    response.json({ liked: !existing, likes: Number(total.value) });
  } catch (error) { next(error); }
});

app.post("/api/basket/:artworkId", auth, onboarded, async (request: AuthedRequest, response, next) => {
  try {
    const artworkId = z.string().uuid().parse(request.params.artworkId);
    const [artwork] = await db.select({ id: artworks.id }).from(artworks).where(eq(artworks.id, artworkId)).limit(1);
    if (!artwork) throw new HttpError(404, "Artwork not found");
    const inserted = await db.insert(basketItems).values({ userId: request.user!.id, artworkId }).onConflictDoNothing().returning();
    if (inserted.length) await db.insert(analyticsEvents).values({ name: "basket_added", userId: request.user!.id, artworkId });
    response.json(await db.select().from(basketItems).where(eq(basketItems.userId, request.user!.id)));
  } catch (error) { next(error); }
});

app.delete("/api/basket/:artworkId", auth, onboarded, async (request: AuthedRequest, response, next) => {
  try {
    const artworkId = z.string().uuid().parse(request.params.artworkId);
    const deleted = await db.delete(basketItems).where(and(eq(basketItems.userId, request.user!.id), eq(basketItems.artworkId, artworkId))).returning();
    if (deleted.length) await db.insert(analyticsEvents).values({ name: "basket_removed", userId: request.user!.id, artworkId });
    response.json(await db.select().from(basketItems).where(eq(basketItems.userId, request.user!.id)));
  } catch (error) { next(error); }
});

app.post("/api/artworks", auth, onboarded, uploadLimiter, async (request: AuthedRequest, response, next) => {
  let objectKey = "";
  try {
    if (!request.user!.roles.includes("artist")) throw new HttpError(403, "Artist role required");
    const input = artworkSchema.parse(request.body);
    const parsedImage = parseImageDataUrl(input.images[0]);
    objectKey = await uploadImage(`artists/${request.user!.id}/artworks`, parsedImage);
    const artwork = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${request.user!.id}))`);
      const [total] = await tx.select({ value: count() }).from(artworks).where(eq(artworks.artistId, request.user!.id));
      if (Number(total.value) >= config.maxArtworksPerArtist) throw new HttpError(409, `The ${config.maxArtworksPerArtist}-artwork limit has been reached`);
      const [created] = await tx.insert(artworks).values({ artistId: request.user!.id, title: input.title, description: input.description, medium: input.medium, year: input.year, width: String(input.width), height: String(input.height), priceCents: Math.round(input.price * 100), currency: input.currency, available: input.available, status: input.status, tags: input.tags }).returning();
      await tx.insert(artworkMedia).values({ artworkId: created.id, objectKey, contentType: parsedImage.contentType, byteSize: parsedImage.bytes.length, position: 0 });
      return created;
    });
    response.status(201).json({ id: artwork.id });
  } catch (error) { if (objectKey) await deleteImage(objectKey).catch(console.error); next(error); }
});

app.patch("/api/artworks/:artworkId", auth, onboarded, async (request: AuthedRequest, response, next) => {
  try {
    const artworkId = z.string().uuid().parse(request.params.artworkId); const input = artworkPatchSchema.parse(request.body);
    const [existing] = await db.select().from(artworks).where(eq(artworks.id, artworkId)).limit(1);
    if (!existing) throw new HttpError(404, "Artwork not found");
    if (existing.artistId !== request.user!.id && !request.user!.roles.includes("admin")) throw new HttpError(403, "Not allowed");
    const [updated] = await db.update(artworks).set({
      ...(input.title !== undefined ? { title: input.title } : {}), ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.medium !== undefined ? { medium: input.medium } : {}), ...(input.year !== undefined ? { year: input.year } : {}),
      ...(input.width !== undefined ? { width: String(input.width) } : {}), ...(input.height !== undefined ? { height: String(input.height) } : {}),
      ...(input.price !== undefined ? { priceCents: Math.round(input.price * 100) } : {}), ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.available !== undefined ? { available: input.available } : {}), ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}), updatedAt: new Date(),
    }).where(eq(artworks.id, artworkId)).returning();
    response.json(updated);
  } catch (error) { next(error); }
});

app.post("/api/views", auth, onboarded, uploadLimiter, async (request: AuthedRequest, response, next) => {
  let objectKey = "";
  try {
    const artworkId = z.string().uuid().parse(request.body.artworkId); const image = parseImageDataUrl(request.body.imageDataUrl);
    objectKey = await uploadImage(`buyers/${request.user!.id}/views`, image);
    const view = await db.transaction(async (tx) => {
      const [created] = await tx.insert(savedViews).values({ userId: request.user!.id, artworkId, objectKey, composition: typeof request.body.composition === "object" ? request.body.composition : {} }).returning();
      await tx.insert(analyticsEvents).values({ name: "ar_view_saved", userId: request.user!.id, artworkId }); return created;
    });
    response.status(201).json({ id: view.id, imageDataUrl: await signImageUrl(view.objectKey), createdAt: view.createdAt.toISOString() });
  } catch (error) { if (objectKey) await deleteImage(objectKey).catch(console.error); next(error); }
});

app.post("/api/events", auth, onboarded, async (request: AuthedRequest, response, next) => {
  try { const event = eventSchema.parse(request.body); const [created] = await db.insert(analyticsEvents).values({ name: event.name, userId: request.user!.id, artworkId: event.artworkId }).returning(); if (["ar_started", "ar_camera_started", "ar_view_saved", "ar_view_shared"].includes(event.name)) void refreshLeadSheet(request.user!.id).catch(console.error); response.status(201).json(created); } catch (error) { next(error); }
});

app.get("/api/admin/stats", auth, onboarded, async (request: AuthedRequest, response, next) => {
  try {
    if (!request.user!.roles.includes("admin")) throw new HttpError(403, "Admin role required");
    const [userRows, artworkRows, likeRows, basketRows, eventRows, viewRows] = await Promise.all([db.select().from(users).where(isNotNull(users.onboardingCompletedAt)), db.select().from(artworks), db.select().from(likes), db.select().from(basketItems), db.select().from(analyticsEvents), db.select().from(savedViews)]);
    response.json({ users: userRows.length, buyers: userRows.filter((user) => !user.roles.includes("artist")).length, artists: userRows.filter((user) => user.roles.includes("artist")).length, artworks: artworkRows.length, likes: likeRows.length, inBaskets: basketRows.length, views: eventRows.filter((event) => event.name === "artwork_opened").length, arTries: eventRows.filter((event) => event.name === "ar_started").length, savedViews: viewRows.length });
  } catch (error) { next(error); }
});

if (config.nodeEnv === "production") {
  const dist = path.resolve(process.cwd(), "dist");
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get("*", (_request, response) => response.sendFile(path.join(dist, "index.html")));
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) return response.status(400).json({ error: error.issues[0]?.message || "Invalid request" });
  if (error instanceof HttpError) return response.status(error.status).json({ error: error.message });
  console.error(error); return response.status(500).json({ error: "Unexpected server error" });
});

const server = app.listen(config.port, "0.0.0.0", () => console.log(`ArtWall listening on http://0.0.0.0:${config.port}`));
const shutdown = async () => { server.close(); await pool.end(); };
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);

