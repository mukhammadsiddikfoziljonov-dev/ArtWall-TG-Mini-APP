import { Compass, Heart, Palette, ShoppingBag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminDashboard } from "./screens/AdminDashboard";
import { ArtworkDetail } from "./screens/ArtworkDetail";
import { ArtistStudio } from "./screens/ArtistStudio";
import { ARStudio } from "./screens/ARStudio";
import { Basket } from "./screens/Basket";
import { Discover } from "./screens/Discover";
import { Liked } from "./screens/Liked";
import { Profile } from "./screens/Profile";
import { useStore } from "./store";
import { t, type Language } from "./i18n";
import type { Artwork } from "./types";

type Tab = "discover" | "liked" | "basket" | "profile";
type Overlay = "detail" | "ar" | "artist" | "admin" | null;

export default function App() {
  const { currentUser, basket, isTelegram, chooseRole } = useStore();
  const [tab, setTab] = useState<Tab>("discover");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("artwall-language") as Language) || "en");
  const [needsOnboarding, setNeedsOnboarding] = useState(() => isTelegram && !localStorage.getItem("artwall-onboarding-complete"));

  useEffect(() => localStorage.setItem("artwall-language", language), [language]);

  const openArtwork = (artwork: Artwork) => {
    setSelected(artwork);
    setOverlay("detail");
  };
  const openAR = (artwork: Artwork) => {
    setSelected(artwork);
    setOverlay("ar");
  };
  const goBack = () => {
    if (overlay === "ar") setOverlay("detail");
    else setOverlay(null);
  };

  if (selected && overlay === "ar") return <ARStudio artwork={selected} language={language} onBack={goBack} />;
  if (selected && overlay === "detail") return <ArtworkDetail artwork={selected} language={language} onBack={() => setOverlay(null)} onAR={() => openAR(selected)} />;
  if (overlay === "artist") return <ArtistStudio onBack={() => setOverlay(null)} onOpen={openArtwork} onAR={openAR} />;
  if (overlay === "admin") return <AdminDashboard onBack={() => setOverlay(null)} />;

  return (
    <div className="min-h-[100dvh] bg-[#f4f1ea] text-[#20201d]">
      {needsOnboarding && (
        <div className="fixed inset-0 z-[100] grid place-items-end bg-black/45 p-3 backdrop-blur-sm sm:place-items-center">
          <section className="w-full max-w-md rounded-[30px] bg-[#f4f1ea] p-6 shadow-2xl">
            <p className="eyebrow">Welcome to ArtWall</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight">How will you use the platform?</h1>
            <p className="mt-3 text-sm leading-6 text-stone-500">Your Telegram account is ready. Artists can still browse and collect art.</p>
            <div className="mt-6 space-y-3">
              <button onClick={() => { chooseRole("buyer"); localStorage.setItem("artwall-onboarding-complete", "1"); setNeedsOnboarding(false); }} className="menu-row !p-4"><span className="menu-icon bg-[#dfe9df]"><ShoppingBag size={20} /></span><span className="flex-1 text-left"><strong>Continue as buyer</strong><small>Discover, visualize, like and collect artworks</small></span></button>
              <button onClick={() => { chooseRole("artist"); localStorage.setItem("artwall-onboarding-complete", "1"); setNeedsOnboarding(false); }} className="menu-row !p-4"><span className="menu-icon bg-[#e7ded0]"><Palette size={20} /></span><span className="flex-1 text-left"><strong>Join as artist</strong><small>Build a profile and publish up to five artworks</small></span></button>
            </div>
          </section>
        </div>
      )}
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
        {tab === "discover" && <Discover language={language} onOpen={openArtwork} />}
        {tab === "liked" && <Liked language={language} onOpen={openArtwork} />}
        {tab === "basket" && <Basket language={language} />}
        {tab === "profile" && <Profile language={language} onArtist={() => setOverlay("artist")} onAdmin={() => setOverlay("admin")} />}
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

