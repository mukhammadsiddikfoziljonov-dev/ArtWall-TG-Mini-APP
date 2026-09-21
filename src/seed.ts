import type { Artwork, PlatformState, User } from "./types";

const now = new Date().toISOString();

export const demoUsers: User[] = [
  {
    id: "artist-a",
    telegramId: "10001",
    name: "Mira Safina",
    username: "mirasafina",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    roles: ["buyer", "artist"],
    bio: "Contemporary artist exploring quiet landscapes, memory and light.",
    location: "Tashkent, Uzbekistan",
    social: "@mirasafina",
    createdAt: now,
  },
  {
    id: "artist-b",
    telegramId: "10002",
    name: "Anton Reyes",
    username: "antonreyes",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
    roles: ["buyer", "artist"],
    bio: "Painter and printmaker working between abstraction and architecture.",
    location: "Almaty, Kazakhstan",
    social: "@antonreyes",
    createdAt: now,
  },
];

const art = (
  id: string,
  artistId: string,
  artistName: string,
  title: string,
  image: string,
  price: number,
  medium: string,
  width: number,
  height: number,
  tags: string[],
  stats: Partial<Artwork["stats"]> = {},
): Artwork => ({
  id,
  artistId,
  artistName,
  title,
  description: `${title} is an original work shaped by atmosphere, texture and the subtle rhythm of everyday spaces.`,
  medium,
  year: 2026,
  width,
  height,
  price,
  currency: "USD",
  available: true,
  status: "published",
  images: [image],
  tags,
  createdAt: now,
  stats: {
    views: stats.views ?? 0,
    uniqueViewers: [],
    likes: stats.likes ?? 0,
    basketAdds: stats.basketAdds ?? 0,
    arTries: stats.arTries ?? 0,
    shares: stats.shares ?? 0,
  },
});

export const demoArtworks: Artwork[] = [
  art("art-1", "artist-a", "Mira Safina", "Still Morning", "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=88", 820, "Oil on canvas", 70, 90, ["abstract", "calm", "blue"], { views: 142, likes: 38, arTries: 29 }),
  art("art-2", "artist-b", "Anton Reyes", "Terracotta City", "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1200&q=88", 640, "Acrylic on linen", 60, 80, ["modern", "warm", "city"], { views: 96, likes: 24, arTries: 18 }),
  art("art-3", "artist-a", "Mira Safina", "Garden After Rain", "/artworks/garden.svg", 980, "Oil and pigment", 90, 110, ["nature", "green", "textural"], { views: 188, likes: 51, arTries: 45 }),
  art("art-4", "artist-b", "Anton Reyes", "Intervals No. 4", "https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?auto=format&fit=crop&w=1200&q=88", 570, "Archival print", 50, 70, ["graphic", "colour", "edition"], { views: 83, likes: 20, arTries: 15 }),
  art("art-5", "artist-a", "Mira Safina", "Distant Water", "/artworks/distant.svg", 760, "Oil on wood", 80, 60, ["landscape", "minimal", "water"], { views: 121, likes: 33, arTries: 27 }),
  art("art-6", "artist-b", "Anton Reyes", "Soft Geometry", "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=88", 430, "Giclée print", 50, 50, ["abstract", "gradient", "edition"], { views: 74, likes: 19, arTries: 12 }),
];

export const initialState: PlatformState = {
  users: demoUsers,
  artworks: demoArtworks,
  likes: {},
  baskets: {},
  savedViews: [],
  events: [],
};
