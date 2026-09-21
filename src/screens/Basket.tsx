import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { t, type Language } from "../i18n";

export function Basket({ language }: { language: Language }) {
  const { state, basket, removeFromBasket } = useStore();
  const items = basket.map((item) => ({ ...item, artwork: state.artworks.find((artwork) => artwork.id === item.artworkId)! })).filter((item) => item.artwork);
  const total = items.reduce((sum, item) => sum + item.artwork.price * item.quantity, 0);

  return (
    <div className="page-shell">
      <div className="section-heading">
        <div><p className="eyebrow">Reserved for you</p><h1>{t(language, "basket")}</h1></div>
        <span className="count-badge">{items.length}</span>
      </div>
      {items.length ? (
        <>
          <div className="space-y-3">
            {items.map(({ artwork }) => (
              <article key={artwork.id} className="flex gap-4 rounded-[22px] bg-white p-3 shadow-[0_8px_28px_rgba(40,36,28,.05)]">
                <img src={artwork.images[0]} alt={artwork.title} className="h-28 w-24 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1 py-1">
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#667b6e]">{artwork.artistName}</p>
                  <h3 className="mt-1 truncate font-serif text-xl">{artwork.title}</h3>
                  <p className="mt-1 text-xs text-stone-500">{artwork.width} × {artwork.height} cm</p>
                  <p className="mt-3 font-semibold">${artwork.price.toLocaleString()}</p>
                </div>
                <button onClick={() => removeFromBasket(artwork.id)} className="self-start rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-red-500" aria-label="Remove"><Trash2 size={17} /></button>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-[26px] bg-[#24362e] p-5 text-white">
            <div className="flex items-center justify-between text-sm text-white/65"><span>{t(language, "total")}</span><span>{items.length} items</span></div>
            <div className="mt-2 flex items-end justify-between"><strong className="font-serif text-4xl">${total.toLocaleString()}</strong><span className="text-xs text-white/50">USD</span></div>
            <div className="mt-5 rounded-2xl bg-white/10 px-4 py-3 text-xs leading-5 text-white/70">Checkout will be added in the next commerce release. Your basket is saved automatically.</div>
            <button disabled className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/20 py-3.5 text-sm font-semibold text-white/50">Checkout coming soon <ArrowRight size={16} /></button>
          </div>
        </>
      ) : (
        <div className="empty-state min-h-[55dvh]"><ShoppingBag size={34} /><h2>Your basket is empty</h2><p>{t(language, "emptyBasket")}</p></div>
      )}
    </div>
  );
}
