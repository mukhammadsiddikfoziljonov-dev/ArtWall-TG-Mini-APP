import { ArrowLeft, Check, Heart, Maximize2, Share2, ShoppingBag } from "lucide-react";
import type { Artwork } from "../types";
import { useStore } from "../store";
import { t, type Language } from "../i18n";

export function ArtworkDetail({ artwork, language, onBack, onAR }: { artwork: Artwork; language: Language; onBack: () => void; onAR: () => void }) {
  const { isLiked, toggleLike, addToBasket, basket, track } = useStore();
  const liked = isLiked(artwork.id);
  const added = basket.some((item) => item.artworkId === artwork.id);

  const share = async () => {
    track("ar_view_shared", artwork.id);
    const data = { title: artwork.title, text: `${artwork.title} by ${artwork.artistName}`, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard?.writeText(window.location.href);
  };

  return (
    <div className="min-h-[100dvh] bg-[#f4f1ea] pb-28">
      <div className="relative">
        <img src={artwork.images[0]} alt={artwork.title} className="h-[48dvh] min-h-[390px] w-full object-cover" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button onClick={onBack} className="round-action" aria-label="Back"><ArrowLeft size={20} /></button>
          <div className="flex gap-2">
            <button onClick={() => toggleLike(artwork.id)} className={`round-action ${liked ? "!bg-[#ff6b59] !text-white" : ""}`} aria-label="Like"><Heart size={19} fill={liked ? "currentColor" : "none"} /></button>
            <button onClick={share} className="round-action" aria-label="Share"><Share2 size={19} /></button>
          </div>
        </div>
      </div>

      <article className="relative -mt-7 rounded-t-[32px] bg-[#f4f1ea] px-5 pt-7">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#667b6e]">{artwork.artistName}</p>
          <span className="flex items-center gap-1 rounded-full bg-[#dfe9df] px-3 py-1.5 text-[11px] font-semibold text-[#355343]"><Check size={13} /> {t(language, "available")}</span>
        </div>
        <h1 className="font-serif text-[38px] leading-tight text-[#20201d]">{artwork.title}</h1>
        <div className="mt-3 flex items-end justify-between">
          <p className="text-sm text-stone-500">{artwork.medium}, {artwork.year}<br />{artwork.width} × {artwork.height} cm</p>
          <p className="text-2xl font-semibold">${artwork.price.toLocaleString()}</p>
        </div>
        <p className="mt-7 text-[15px] leading-7 text-stone-600">{artwork.description}</p>

        <div className="mt-7 grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 text-center shadow-sm">
          <div><strong className="block text-lg">{artwork.stats.views}</strong><span className="text-[10px] uppercase tracking-wider text-stone-400">Views</span></div>
          <div className="border-x border-stone-100"><strong className="block text-lg">{artwork.stats.likes}</strong><span className="text-[10px] uppercase tracking-wider text-stone-400">Likes</span></div>
          <div><strong className="block text-lg">{artwork.stats.arTries}</strong><span className="text-[10px] uppercase tracking-wider text-stone-400">AR tries</span></div>
        </div>
      </article>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200/70 bg-[#f4f1ea]/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl gap-2">
          <button onClick={onAR} className="primary-button flex-1"><Maximize2 size={18} /> {t(language, "viewWall")}</button>
          <button onClick={() => addToBasket(artwork.id)} className={`secondary-button min-w-[128px] ${added ? "!bg-[#dfe9df] !text-[#355343]" : ""}`}>
            {added ? <Check size={18} /> : <ShoppingBag size={18} />} {added ? t(language, "added") : t(language, "addBasket")}
          </button>
        </div>
      </div>
    </div>
  );
}
