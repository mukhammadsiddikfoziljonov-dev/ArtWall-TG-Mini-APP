import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import dotenv from "dotenv";
import { initialState } from "../src/seed.ts";
import type { AnalyticsEventName, Artwork, PlatformState, Role, SavedView, User } from "../src/types.ts";

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT || 3001);
const dataPath = path.resolve(process.cwd(), "server", "data.json");
const sessionSecret = process.env.SESSION_SECRET || "local-preview-only-change-me";
const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const adminTelegramIds = new Set((process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));

app.use(express.json({ limit: "25mb" }));

const readState = (): PlatformState => {
  try {
    if (fs.existsSync(dataPath)) return JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (error) {
    console.error("Unable to read data store", error);
  }
  return structuredClone(initialState);
};
let state = readState();

const persist = () => {
  const temporary = `${dataPath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2));
  fs.renameSync(temporary, dataPath);
};

type SessionPayload = { userId: string; exp: number };
type AuthedRequest = Request & { user?: User };

const sign = (payload: SessionPayload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};

const readSession = (token: string): SessionPayload | null => {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", sessionSecret).update(encoded).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
  return payload.exp > Date.now() ? payload : null;
};

const issueSession = (user: User) => ({ token: sign({ userId: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }), user });

const auth = (request: AuthedRequest, response: Response, next: NextFunction) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const session = token ? readSession(token) : null;
  const user = session ? state.users.find((item) => item.id === session.userId) : undefined;
  if (!user) return response.status(401).json({ error: "Authentication required" });
  request.user = user;
  next();
};

const validateTelegramInitData = (initData: string) => {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new Error("Missing Telegram signature");
  params.delete("hash");
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > 3600) throw new Error("Telegram session is expired");
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (receivedHash.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(expected))) throw new Error("Invalid Telegram signature");
  const rawUser = params.get("user");
  if (!rawUser) throw new Error("Telegram user is missing");
  return JSON.parse(rawUser) as { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string };
};

app.get("/api/health", (_request, response) => response.json({ ok: true }));

app.post("/api/auth/telegram", (request, response) => {
  try {
    const telegram = validateTelegramInitData(String(request.body.initData || ""));
    const telegramId = String(telegram.id);
    let user = state.users.find((item) => item.telegramId === telegramId);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        telegramId,
        name: [telegram.first_name, telegram.last_name].filter(Boolean).join(" "),
        username: telegram.username,
        avatarUrl: telegram.photo_url,
        roles: adminTelegramIds.has(telegramId) ? ["buyer", "artist", "admin"] : ["buyer"],
        createdAt: new Date().toISOString(),
      };
      state.users.push(user);
      persist();
    }
    response.json(issueSession(user));
  } catch (error) {
    response.status(401).json({ error: error instanceof Error ? error.message : "Telegram authentication failed" });
  }
});

app.post("/api/auth/preview", (request, response) => {
  if (process.env.NODE_ENV === "production") return response.status(404).end();
  const role = (["buyer", "artist", "admin"].includes(request.body.role) ? request.body.role : "buyer") as Role;
  const id = `preview-${role}`;
  let user = state.users.find((item) => item.id === id);
  if (!user) {
    user = {
      id,
      telegramId: `preview-${role}`,
      name: role === "admin" ? "ArtWall Admin" : role === "artist" ? "Demo Artist" : "Telegram Buyer",
      username: role === "admin" ? "artwall_admin" : role === "artist" ? "demo_artist" : "artwall_buyer",
      roles: role === "admin" ? ["buyer", "artist", "admin"] : role === "artist" ? ["buyer", "artist"] : ["buyer"],
      bio: role !== "buyer" ? "Contemporary artist building a collection on ArtWall." : undefined,
      location: role !== "buyer" ? "Tashkent, Uzbekistan" : undefined,
      createdAt: new Date().toISOString(),
    };
    state.users.push(user);
    persist();
  }
  response.json(issueSession(user));
});

app.get("/api/bootstrap", auth, (request: AuthedRequest, response) => {
  const user = request.user!;
  const admin = user.roles.includes("admin");
  response.json({
    user,
    state: {
      ...state,
      likes: admin ? state.likes : { [user.id]: state.likes[user.id] ?? [] },
      baskets: admin ? state.baskets : { [user.id]: state.baskets[user.id] ?? [] },
      savedViews: admin ? state.savedViews : state.savedViews.filter((view) => view.userId === user.id),
    },
  });
});

app.patch("/api/profile", auth, (request: AuthedRequest, response) => {
  const allowed = ["name", "bio", "location", "social", "avatarUrl"] as const;
  state.users = state.users.map((user) => user.id === request.user!.id
    ? { ...user, ...Object.fromEntries(allowed.filter((key) => typeof request.body[key] === "string").map((key) => [key, request.body[key]])) }
    : user);
  persist();
  response.json(state.users.find((user) => user.id === request.user!.id));
});

app.post("/api/profile/role", auth, (request: AuthedRequest, response) => {
  const role = request.body.role === "artist" ? "artist" : "buyer";
  const user = state.users.find((item) => item.id === request.user!.id)!;
  user.roles = role === "artist" ? Array.from(new Set([...user.roles, "buyer", "artist"])) : Array.from(new Set([...user.roles, "buyer"]));
  persist();
  response.json(user);
});

app.post("/api/likes/:artworkId/toggle", auth, (request: AuthedRequest, response) => {
  const artwork = state.artworks.find((item) => item.id === request.params.artworkId);
  if (!artwork) return response.status(404).json({ error: "Artwork not found" });
  const current = state.likes[request.user!.id] ?? [];
  const liked = current.includes(artwork.id);
  state.likes[request.user!.id] = liked ? current.filter((id) => id !== artwork.id) : [...current, artwork.id];
  artwork.stats.likes = Math.max(0, artwork.stats.likes + (liked ? -1 : 1));
  if (!liked) state.events.push({ id: crypto.randomUUID(), name: "artwork_liked", userId: request.user!.id, artworkId: artwork.id, createdAt: new Date().toISOString() });
  persist();
  response.json({ liked: !liked, likes: artwork.stats.likes });
});

app.post("/api/basket/:artworkId", auth, (request: AuthedRequest, response) => {
  const artwork = state.artworks.find((item) => item.id === request.params.artworkId);
  if (!artwork) return response.status(404).json({ error: "Artwork not found" });
  const basket = state.baskets[request.user!.id] ?? [];
  if (!basket.some((item) => item.artworkId === artwork.id)) {
    state.baskets[request.user!.id] = [...basket, { artworkId: artwork.id, quantity: 1 }];
    artwork.stats.basketAdds += 1;
    state.events.push({ id: crypto.randomUUID(), name: "basket_added", userId: request.user!.id, artworkId: artwork.id, createdAt: new Date().toISOString() });
    persist();
  }
  response.json(state.baskets[request.user!.id]);
});

app.delete("/api/basket/:artworkId", auth, (request: AuthedRequest, response) => {
  state.baskets[request.user!.id] = (state.baskets[request.user!.id] ?? []).filter((item) => item.artworkId !== request.params.artworkId);
  state.events.push({ id: crypto.randomUUID(), name: "basket_removed", userId: request.user!.id, artworkId: request.params.artworkId, createdAt: new Date().toISOString() });
  persist();
  response.json(state.baskets[request.user!.id]);
});

app.post("/api/artworks", auth, (request: AuthedRequest, response) => {
  const user = request.user!;
  if (!user.roles.includes("artist")) return response.status(403).json({ error: "Artist role required" });
  if (state.artworks.filter((item) => item.artistId === user.id).length >= 7) return response.status(409).json({ error: "The seven-artwork limit has been reached" });
  const artwork: Artwork = {
    ...request.body,
    id: crypto.randomUUID(),
    artistId: user.id,
    artistName: user.name,
    createdAt: new Date().toISOString(),
    stats: { views: 0, uniqueViewers: [], likes: 0, basketAdds: 0, arTries: 0, shares: 0 },
  };
  state.artworks.unshift(artwork);
  persist();
  response.status(201).json(artwork);
});

app.patch("/api/artworks/:artworkId", auth, (request: AuthedRequest, response) => {
  const artwork = state.artworks.find((item) => item.id === request.params.artworkId);
  if (!artwork) return response.status(404).json({ error: "Artwork not found" });
  if (artwork.artistId !== request.user!.id && !request.user!.roles.includes("admin")) return response.status(403).json({ error: "Not allowed" });
  Object.assign(artwork, request.body, { id: artwork.id, artistId: artwork.artistId, stats: artwork.stats });
  persist();
  response.json(artwork);
});

app.post("/api/views", auth, (request: AuthedRequest, response) => {
  const view: SavedView = { id: crypto.randomUUID(), userId: request.user!.id, artworkId: request.body.artworkId, imageDataUrl: request.body.imageDataUrl, createdAt: new Date().toISOString() };
  state.savedViews.unshift(view);
  state.events.push({ id: crypto.randomUUID(), name: "ar_view_saved", userId: request.user!.id, artworkId: view.artworkId, createdAt: new Date().toISOString() });
  persist();
  response.status(201).json(view);
});

app.post("/api/events", auth, (request: AuthedRequest, response) => {
  const allowed: AnalyticsEventName[] = ["artwork_impression", "artwork_opened", "artwork_liked", "basket_added", "basket_removed", "ar_started", "ar_camera_started", "ar_view_saved", "ar_view_shared", "artist_profile_opened"];
  if (!allowed.includes(request.body.name)) return response.status(400).json({ error: "Unknown event" });
  const event = { id: crypto.randomUUID(), name: request.body.name as AnalyticsEventName, userId: request.user!.id, artworkId: request.body.artworkId, createdAt: new Date().toISOString() };
  state.events.push(event);
  const artwork = state.artworks.find((item) => item.id === event.artworkId);
  if (artwork) {
    if (event.name === "artwork_opened") {
      artwork.stats.views += 1;
      if (!artwork.stats.uniqueViewers.includes(request.user!.id)) artwork.stats.uniqueViewers.push(request.user!.id);
    }
    if (event.name === "ar_started") artwork.stats.arTries += 1;
    if (event.name === "ar_view_shared") artwork.stats.shares += 1;
  }
  persist();
  response.status(201).json(event);
});

app.get("/api/admin/stats", auth, (request: AuthedRequest, response) => {
  if (!request.user!.roles.includes("admin")) return response.status(403).json({ error: "Admin role required" });
  response.json({ users: state.users.length, artists: state.users.filter((user) => user.roles.includes("artist")).length, artworks: state.artworks.length, events: state.events.length });
});

app.listen(port, () => console.log(`ArtWall API listening on http://localhost:${port}`));
