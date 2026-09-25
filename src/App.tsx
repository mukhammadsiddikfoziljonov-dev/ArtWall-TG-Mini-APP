import { Camera, Compass, Heart, ShoppingBag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminDashboard } from "./screens/AdminDashboard";
import { ArtworkDetail } from "./screens/ArtworkDetail";
import { ArtistStudio } from "./screens/ArtistStudio";
import { ARStudio } from "./screens/ARStudio";
import { Basket } from "./screens/Basket";
import { Discover } from "./screens/Discover";
import { Liked } from "./screens/Liked";
import { Profile } from "./screens/Profile";
import { Signup } from "./screens/Signup";
import { useStore } from "./store";
import { t, type Language } from "./i18n";
import type { Artwork } from "./types";

type Tab = "discover" | "liked" | "basket" | "profile";
type Overlay = "detail" | "ar" | "artist" | "admin" | null;

const demoArtwork: Artwork = {
  id: "artwall-demo",
  artistId: "artwall",
  artistName: "ArtWall Demo",
  title: "Garden Light",
  description: "A sample artwork prepared for the live-camera AR demonstration.",
  medium: "Digital preview",
  year: 2026,
  width: 70,
  height: 90,
  price: 0,
  currency: "USD",
  available: false,
  status: "published",
  images: ["/artworks/garden.svg"],
  tags: ["demo"],
  createdAt: new Date(0).toISOString(),
  stats: { views: 0, uniqueViewers: [], likes: 0, basketAdds: 0, arTries: 0, shares: 0 },
};

export default function App() {
  const { currentUser, basket, authReady, authError } = useStore();
  const [tab, setTab] = useState<Tab>("discover");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("artwall-language") as Language) || "en");

  useEffect(() => localStorage.setItem("artwall-language", language), [language]);

  const openArtwork = (artwork: Artwork) => {
    setSelected(artwork);
    setOverlay("detail");
  };
  const openAR = (artwork: Artwork) => {
    setSelected(artwork);
    setOverlay("ar");
  };
  const openDemo = () => {
    setSelected(demoArtwork);
    setOverlay("ar");
  };
  const goBack = () => {
    if (overlay === "ar" && selected?.id === demoArtwork.id) { setSelected(null); setOverlay(null); }
    else if (overlay === "ar") setOverlay("detail");
    else setOverlay(null);
  };

  if (!authReady) return <div className="grid min-h-[100dvh] place-items-center bg-[#f4f1ea]"><div className="text-center"><p className="font-serif text-4xl italic">ArtWall</p><p className="mt-3 text-xs uppercase tracking-[.18em] text-stone-400">Preparing your AR demo…</p></div></div>;
  if (authError) return <div className="grid min-h-[100dvh] place-items-center bg-[#f4f1ea] p-6"><div className="max-w-sm rounded-[28px] bg-white p-6 text-center shadow-sm"><h1 className="font-serif text-3xl">Unable to sign in</h1><p className="mt-3 text-sm leading-6 text-stone-500">{authError}</p><button onClick={() => window.location.reload()} className="primary-button mt-5 w-full">Try again</button></div></div>;
  if (!currentUser.onboardingCompletedAt) return <Signup onComplete={openDemo} />;

  if (selected && overlay === "ar") return <ARStudio artwork={selected} language={language} onBack={goBack} demoMode={selected.id === demoArtwork.id} />;
  if (selected && overlay === "detail") return <ArtworkDetail artwork={selected} language={language} onBack={() => setOverlay(null)} onAR={() => openAR(selected)} />;
  if (overlay === "artist") return <ArtistStudio onBack={() => setOverlay(null)} onOpen={openArtwork} onAR={openAR} />;
  if (overlay === "admin" && currentUser.roles.includes("admin")) return <AdminDashboard onBack={() => setOverlay(null)} />;

  return (
    <div className="min-h-[100dvh] bg-[#f4f1ea] text-[#20201d]">
      <header className="sticky top-0 z-30 border-b border-stone-200/60 bg-[#f4f1ea]/90 px-4 py-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button onClick={() => setTab("discover")} className="font-serif text-[27px] italic leading-none">ArtWall</button>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-white p-1 shadow-sm">
              {(["en", "ru", "uz"] as Language[]).map((item) => <button key={item} onClick={() => setLanguage(item)} className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${language === item ? "bg-[#20201d] text-white" : "text-stone-400"}`}>{item}</button>)}
            </div>
            <button onClick={() => setTab("profile")} className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#d8c8ad] font-serif text-[#24362e]">
              {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} className="h-full w-full object-cover" /> : currentUser.name.charAt(0)}
            </button>
          </div>
        </div>
      </header>

      <main>
        {tab === "discover" && <><section className="mx-auto max-w-2xl px-4 pt-5"><button onClick={openDemo} className="flex w-full items-center gap-4 rounded-[26px] bg-[#24362e] p-5 text-left text-white shadow-sm"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10"><Camera size={22} /></span><span className="min-w-0 flex-1"><small className="block text-[9px] font-bold uppercase tracking-[.18em] text-white/50">Live camera</small><strong className="mt-1 block font-serif text-2xl">Try the AR wall demo</strong><span className="mt-1 block text-xs text-white/60">Place, resize, save and share</span></span><span className="rounded-full bg-white px-3 py-2 text-[10px] font-bold text-[#24362e]">OPEN</span></button></section><Discover language={language} onOpen={openArtwork} /></>}
        {tab === "liked" && <Liked language={language} onOpen={openArtwork} />}
        {tab === "basket" && <Basket language={language} />}
        {tab === "profile" && <Profile language={language} onArtist={() => setOverlay("artist")} onAdmin={() => currentUser.roles.includes("admin") && setOverlay("admin")} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/70 bg-[#f4f1ea]/95 px-3 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {([
            ["discover", Compass, t(language, "discover")],
            ["liked", Heart, t(language, "liked")],
            ["basket", ShoppingBag, t(language, "basket")],
            ["profile", UserRound, t(language, "profile")],
          ] as const).map(([item, Icon, label]) => (
            <button key={item} onClick={() => setTab(item)} className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-semibold transition ${tab === item ? "text-[#24362e]" : "text-stone-400"}`}>
              <span className={`grid h-7 w-11 place-items-center rounded-full transition ${tab === item ? "bg-[#dfe9df]" : ""}`}><Icon size={18} fill={item === "liked" && tab === item ? "currentColor" : "none"} /></span>
              {label}
              {item === "basket" && basket.length > 0 && <span className="absolute right-[25%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff6b59] px-1 text-[8px] text-white">{basket.length}</span>}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

