import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramId: text("telegram_id").notNull(),
  source: text("source").notNull().default("telegram"),
  name: text("name").notNull(),
  username: text("username"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  roles: text("roles").array().notNull().default(sql`ARRAY['buyer']::text[]`),
  bio: text("bio"),
  location: text("location"),
  social: text("social"),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_telegram_id_unique").on(table.telegramId)]);

export const artworks = pgTable("artworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  artistId: uuid("artist_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  medium: text("medium").notNull(),
  year: integer("year").notNull(),
  width: numeric("width", { precision: 8, scale: 2 }).notNull(),
  height: numeric("height", { precision: 8, scale: 2 }).notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  available: boolean("available").notNull().default(true),
  status: text("status").notNull().default("draft"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("artworks_artist_idx").on(table.artistId), index("artworks_status_idx").on(table.status)]);

export const artworkMedia = pgTable("artwork_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "cascade" }),
  objectKey: text("object_key"),
  sourceUrl: text("source_url"),
  contentType: text("content_type"),
  byteSize: integer("byte_size"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("artwork_media_artwork_idx").on(table.artworkId), uniqueIndex("artwork_media_position_unique").on(table.artworkId, table.position)]);

export const likes = pgTable("likes", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.artworkId] })]);

export const basketItems = pgTable("basket_items", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.artworkId] })]);

export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "cascade" }),
  objectKey: text("object_key"),
  sourceUrl: text("source_url"),
  composition: jsonb("composition").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("saved_views_user_idx").on(table.userId)]);

export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  artworkId: uuid("artwork_id").references(() => artworks.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("analytics_events_name_idx").on(table.name), index("analytics_events_artwork_idx").on(table.artworkId)]);

export const platformLimits = pgTable("platform_limits", {
  key: text("key").primaryKey(),
  value: integer("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

