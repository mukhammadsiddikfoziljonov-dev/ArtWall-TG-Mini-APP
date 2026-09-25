import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { initialState } from "./seed";
import { api, authenticate } from "./api";
import type { AnalyticsEventName, Artwork, BasketItem, PlatformState, Role, SavedView, User } from "./types";

const STORAGE_KEY = "artwall-mvp-v1";
const DEMO_USER_KEY = "artwall-demo-user";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { user?: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string }; start_param?: string };
        ready?: () => void;
        expand?: () => void;
        setHeaderColor?: (color: string) => void;
        openTelegramLink?: (url: string) => void;
      };
    };
  }
}

type StoreValue = {
  state: PlatformState;
  currentUser: User;
  isTelegram: boolean;
  authReady: boolean;
  authError: string;
  setDemoRole: (role: Role) => void;
  updateProfile: (data: Partial<User>) => void;
  chooseRole: (role: "buyer" | "artist") => void;
  completeSignup: (data: { name: string; phone: string; role: "buyer" | "artist"; consent: true }) => Promise<{ ok: boolean; message?: string }>;
  toggleLike: (artworkId: string) => void;
  isLiked: (artworkId: string) => boolean;
  addToBasket: (artworkId: string) => void;
  removeFromBasket: (artworkId: string) => void;
  basket: BasketItem[];
  createArtwork: (artwork: Omit<Artwork, "id" | "artistId" | "artistName" | "createdAt" | "stats">) => Promise<{ ok: boolean; message?: string }>;
  updateArtwork: (artworkId: string, data: Partial<Artwork>) => void;
  saveView: (artworkId: string, imageDataUrl: string) => void;
  track: (name: AnalyticsEventName, artworkId?: string) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

const readState = (): PlatformState => {
  if (import.meta.env.PROD) return { ...initialState, users: [], artworks: [], likes: {}, baskets: {}, savedViews: [], events: [] };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : initialState;
  } catch {
    return initialState;
  }
};

const makePreviewUser = (role: Role): User => ({
  id: `preview-${role}`,
  telegramId: role === "admin" ? "999001" : role === "artist" ? "999002" : "999003",
  source: "preview",
  name: role === "admin" ? "ArtWall Admin" : role === "artist" ? "Demo Artist" : "Telegram Buyer",
  username: role === "admin" ? "artwall_admin" : role === "artist" ? "demo_artist" : "artwall_buyer",
  roles: role === "admin" ? ["buyer", "artist", "admin"] : role === "artist" ? ["buyer", "artist"] : ["buyer"],
  bio: role === "artist" || role === "admin" ? "Contemporary artist building a collection on ArtWall." : undefined,
  location: role === "artist" || role === "admin" ? "Tashkent, Uzbekistan" : undefined,
  createdAt: new Date().toISOString(),
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlatformState>(readState);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [demoRole, setDemoRoleState] = useState<Role>(() => (localStorage.getItem(DEMO_USER_KEY) as Role) || "buyer");
  const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const isTelegram = Boolean(telegramUser && window.Telegram?.WebApp?.initData);

  const baseUser = useMemo<User>(() => {
    if (!telegramUser) return makePreviewUser(demoRole);
    const isAdmin = String(telegramUser.id) === import.meta.env.VITE_ADMIN_TELEGRAM_ID;
    return {
      id: `tg-${telegramUser.id}`,
      telegramId: String(telegramUser.id),
      source: "telegram",
      name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" "),
      username: telegramUser.username,
      avatarUrl: telegramUser.photo_url,
      roles: isAdmin ? ["buyer", "artist", "admin"] : ["buyer"],
      createdAt: new Date().toISOString(),
    };
  }, [telegramUser?.id, demoRole]);

  const persistedUser = state.users.find((user) => user.id === sessionUser?.id || (baseUser.telegramId && user.telegramId === baseUser.telegramId));
  const currentUser = persistedUser ?? sessionUser ?? baseUser;

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();
    tg?.setHeaderColor?.("#f4f1ea");
  }, []);

  useEffect(() => {
    let cancelled = false;
    authenticate(demoRole)
      .then((data: { user: User }) => {
        if (!cancelled) setSessionUser(data.user);
        return api<{ user: User; state: PlatformState }>("/api/bootstrap");
      })
      .then((data) => {
        if (!cancelled) {
          setSessionUser(data.user);
          setState(data.state);
          setAuthError("");
          setAuthReady(true);
        }
      })
      .catch((error) => {
        console.warn("Authentication failed.", error);
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : "Unable to sign in");
          setAuthReady(true);
        }
      });
    return () => { cancelled = true; };
  }, [demoRole]);

  useEffect(() => {
    setState((previous) => {
      if (import.meta.env.PROD) return previous;
      if (previous.users.some((user) => user.telegramId === baseUser.telegramId)) return previous;
      return { ...previous, users: [...previous.users, baseUser] };
    });
  }, [baseUser.telegramId]);

  useEffect(() => {
    try {
      // Captured room images can be several megabytes. They are persisted by the API,
      // while the lightweight local cache keeps only marketplace state.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedViews: [] }));
    } catch (error) {
      console.warn("Local preview cache is full; API persistence remains available.", error);
    }
  }, [state]);

  const setDemoRole = (role: Role) => {
    localStorage.setItem(DEMO_USER_KEY, role);
    setDemoRoleState(role);
  };

  const updateProfile = (data: Partial<User>) => {
    setState((previous) => ({
      ...previous,
      users: previous.users.map((user) => user.telegramId === currentUser.telegramId ? { ...user, ...data } : user),
    }));
    void api("/api/profile", { method: "PATCH", body: JSON.stringify(data) }).catch(console.warn);
  };

  const chooseRole = (role: "buyer" | "artist") => {
    const roles: Role[] = role === "artist" ? ["buyer", "artist"] : ["buyer"];
    setState((previous) => ({
      ...previous,
      users: previous.users.map((user) => user.telegramId === currentUser.telegramId ? { ...user, roles } : user),
    }));
    void api("/api/profile/role", { method: "POST", body: JSON.stringify({ role }) }).catch(console.warn);
  };

  const completeSignup: StoreValue["completeSignup"] = async (data) => {
    try {
      const result = await api<{ user: User }>("/api/signup", { method: "POST", body: JSON.stringify(data) });
      const refreshed = await api<{ user: User; state: PlatformState }>("/api/bootstrap");
      setSessionUser(result.user);
      setState(refreshed.state);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Unable to complete signup" };
    }
  };

  const track = (name: AnalyticsEventName, artworkId?: string) => {
    setState((previous) => {
      const event = { id: crypto.randomUUID(), name, userId: currentUser.id, artworkId, createdAt: new Date().toISOString() };
      const artworks = artworkId
        ? previous.artworks.map((artwork) => {
            if (artwork.id !== artworkId) return artwork;
            const stats = { ...artwork.stats };
            if (name === "artwork_opened") {
              stats.views += 1;
              if (!stats.uniqueViewers.includes(currentUser.id)) stats.uniqueViewers = [...stats.uniqueViewers, currentUser.id];
            }
            if (name === "basket_added") stats.basketAdds += 1;
            if (name === "ar_started") stats.arTries += 1;
            if (name === "ar_view_shared") stats.shares += 1;
            return { ...artwork, stats };
          })
        : previous.artworks;
      return { ...previous, artworks, events: [...previous.events, event] };
    });
    void api("/api/events", { method: "POST", body: JSON.stringify({ name, artworkId }) }).catch(console.warn);
  };

  const isLiked = (artworkId: string) => (state.likes[currentUser.id] ?? []).includes(artworkId);

  const toggleLike = (artworkId: string) => {
    const liked = isLiked(artworkId);
    setState((previous) => {
      const current = previous.likes[currentUser.id] ?? [];
      return {
        ...previous,
        likes: { ...previous.likes, [currentUser.id]: liked ? current.filter((id) => id !== artworkId) : [...current, artworkId] },
        artworks: previous.artworks.map((artwork) => artwork.id === artworkId
          ? { ...artwork, stats: { ...artwork.stats, likes: Math.max(0, artwork.stats.likes + (liked ? -1 : 1)) } }
          : artwork),
        events: liked ? previous.events : [...previous.events, { id: crypto.randomUUID(), name: "artwork_liked", userId: currentUser.id, artworkId, createdAt: new Date().toISOString() }],
      };
    });
    void api(`/api/likes/${artworkId}/toggle`, { method: "POST" }).catch(console.warn);
  };

  const basket = state.baskets[currentUser.id] ?? [];

  const addToBasket = (artworkId: string) => {
    if (basket.some((item) => item.artworkId === artworkId)) return;
    setState((previous) => ({
      ...previous,
      baskets: { ...previous.baskets, [currentUser.id]: [...(previous.baskets[currentUser.id] ?? []), { artworkId, quantity: 1 }] },
      artworks: previous.artworks.map((artwork) => artwork.id === artworkId ? { ...artwork, stats: { ...artwork.stats, basketAdds: artwork.stats.basketAdds + 1 } } : artwork),
      events: [...previous.events, { id: crypto.randomUUID(), name: "basket_added", userId: currentUser.id, artworkId, createdAt: new Date().toISOString() }],
    }));
    void api(`/api/basket/${artworkId}`, { method: "POST" }).catch(console.warn);
  };

  const removeFromBasket = (artworkId: string) => {
    setState((previous) => ({
      ...previous,
      baskets: { ...previous.baskets, [currentUser.id]: (previous.baskets[currentUser.id] ?? []).filter((item) => item.artworkId !== artworkId) },
      events: [...previous.events, { id: crypto.randomUUID(), name: "basket_removed", userId: currentUser.id, artworkId, createdAt: new Date().toISOString() }],
    }));
    void api(`/api/basket/${artworkId}`, { method: "DELETE" }).catch(console.warn);
  };

  const createArtwork: StoreValue["createArtwork"] = async (artwork) => {
    const count = state.artworks.filter((item) => item.artistId === currentUser.id).length;
    if (count >= 5) return { ok: false, message: "The five-artwork limit has been reached." };
    try {
      await api("/api/artworks", { method: "POST", body: JSON.stringify(artwork) });
      const refreshed = await api<{ state: PlatformState }>("/api/bootstrap");
      setState(refreshed.state);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Unable to save artwork." };
    }
  };

  const updateArtwork = (artworkId: string, data: Partial<Artwork>) => {
    setState((previous) => ({ ...previous, artworks: previous.artworks.map((item) => item.id === artworkId ? { ...item, ...data } : item) }));
    void api(`/api/artworks/${artworkId}`, { method: "PATCH", body: JSON.stringify(data) }).catch(console.warn);
  };

  const saveView = (artworkId: string, imageDataUrl: string) => {
    const view: SavedView = { id: crypto.randomUUID(), userId: currentUser.id, artworkId, imageDataUrl, createdAt: new Date().toISOString() };
    setState((previous) => ({
      ...previous,
      savedViews: [view, ...previous.savedViews],
      events: [...previous.events, { id: crypto.randomUUID(), name: "ar_view_saved", userId: currentUser.id, artworkId, createdAt: new Date().toISOString() }],
    }));
    void api("/api/views", { method: "POST", body: JSON.stringify({ artworkId, imageDataUrl }) }).catch(console.warn);
  };

  return <StoreContext.Provider value={{ state, currentUser, isTelegram, authReady, authError, setDemoRole, updateProfile, chooseRole, completeSignup, toggleLike, isLiked, addToBasket, removeFromBasket, basket, createArtwork, updateArtwork, saveView, track }}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
};

