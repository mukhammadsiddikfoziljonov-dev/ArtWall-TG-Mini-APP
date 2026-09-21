export type Role = "buyer" | "artist" | "admin";
export type ArtworkStatus = "draft" | "published";

export interface User {
  id: string;
  telegramId: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  roles: Role[];
  bio?: string;
  location?: string;
  social?: string;
  createdAt: string;
}

export interface ArtworkStats {
  views: number;
  uniqueViewers: string[];
  likes: number;
  basketAdds: number;
  arTries: number;
  shares: number;
}

export interface Artwork {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  description: string;
  medium: string;
  year: number;
  width: number;
  height: number;
  price: number;
  currency: string;
  available: boolean;
  status: ArtworkStatus;
  images: string[];
  tags: string[];
  createdAt: string;
  stats: ArtworkStats;
}

export interface BasketItem {
  artworkId: string;
  quantity: number;
}

export interface SavedView {
  id: string;
  userId: string;
  artworkId: string;
  imageDataUrl: string;
  createdAt: string;
}

export type AnalyticsEventName =
  | "artwork_impression"
  | "artwork_opened"
  | "artwork_liked"
  | "basket_added"
  | "basket_removed"
  | "ar_started"
  | "ar_camera_started"
  | "ar_view_saved"
  | "ar_view_shared"
  | "artist_profile_opened";

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  userId: string;
  artworkId?: string;
  createdAt: string;
}

export interface PlatformState {
  users: User[];
  artworks: Artwork[];
  likes: Record<string, string[]>;
  baskets: Record<string, BasketItem[]>;
  savedViews: SavedView[];
  events: AnalyticsEvent[];
}
