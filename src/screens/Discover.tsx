import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { ArtworkCard } from "../components/ArtworkCard";
import { useStore } from "../store";
import type { Artwork } from "../types";
import { t, type Language } from "../i18n";

type Sort = "popular" | "newest" | "price";

export function Discover({ language, onOpen }: { language: Language; onOpen: (artwork: Artwork) => void }) {
  const { state, track } = useStore();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("popular");

  const artworks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = state.artworks.filter((artwork) =>
      artwork.status === "published" && artwork.available &&
      (!normalized || [artwork.title, artwork.artistName, artwork.medium, ...artwork.tags].join(" ").toLowerCase().includes(normalized)),
    );
    return [...filtered].sort((a, b) => sort === "popular" ? b.stats.likes - a.stats.likes : sort === "price" ? a.price - b.price : b.createdAt.localeCompare(a.createdAt));
  }, [state.artworks, query, sort]);

  const open = (artwork: Artwork) => {
    track("artwork_opened", artwork.id);
    onOpen(artwork);
  };

  return (
    <div className="page-shell">
      <section className="mb-7 rounded-[28px] bg-[#24362e] px-5 py-6 text-white shadow-[0_18px_50px_rgba(36,54,46,.18)]">
        <div className="mb-5 flex items-start justify-between gap-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#c8d6c8]">
              <Sparkles size={14} /> Curated today
            </div>
            <h2 className="max-w-[260px] font-serif text-[34px] leading-[1.02]">Find the piece your room was waiting for.</h2>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px]">{artworks.length} {t(language, "artworks")}</span>
        </div>
        <label className="flex h-12 items-center gap-3 rounded-2xl bg-white px-4 text-[#20201d] shadow-sm">
          <Search size={18} className="text-stone-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(language, "search")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400" />
        </label>
      </section>

      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="mr-1 flex items-center gap-1 text-xs font-semibold text-stone-500"><SlidersHorizontal size={15} /> {t(language, "filters")}</span>
        {(["popular", "newest", "price"] as Sort[]).map((item) => (
          <button key={item} onClick={() => setSort(item)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${sort === item ? "bg-[#20201d] text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}>
            {item === "popular" ? t(language, "popular") : item === "newest" ? t(language, "newest") : t(language, "priceLow")}
          </button>
        ))}
      </div>

      {artworks.length ? (
        <div className="columns-2 gap-3 sm:gap-5">{artworks.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} onOpen={() => open(artwork)} />)}</div>
      ) : (
        <div className="empty-state"><Search size={28} /><p>No artworks match this search.</p></div>
      )}
    </div>
  );
}
