import { ArrowLeft, BarChart3, Eye, Heart, ImagePlus, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import type { Artwork, ArtworkStatus } from "../types";

const blank = {
  title: "", description: "", medium: "", year: new Date().getFullYear(), width: 60, height: 80,
  price: 0, currency: "USD", available: true, status: "draft" as ArtworkStatus, images: [] as string[], tags: [] as string[],
};

export function ArtistStudio({ onBack, onOpen, onAR }: { onBack: () => void; onOpen: (artwork: Artwork) => void; onAR: (artwork: Artwork) => void }) {
  const { currentUser, state, createArtwork } = useStore();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const artworks = useMemo(() => state.artworks.filter((artwork) => artwork.artistId === currentUser.id), [state.artworks, currentUser.id]);

  const handleImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((previous) => ({ ...previous, images: [String(reader.result), ...previous.images].slice(0, 6) }));
    reader.readAsDataURL(file);
  };

  const submit = (status: ArtworkStatus) => {
    if (!form.title || !form.medium || !form.images[0]) {
      setMessage("Add a title, medium and cover image.");
      return;
    }
    const result = createArtwork({ ...form, status });
    if (!result.ok) {
      setMessage(result.message ?? "Unable to save artwork.");
      return;
    }
    setForm(blank);
    setMessage("");
    setCreating(false);
  };

  const totals = artworks.reduce((sum, artwork) => ({
    views: sum.views + artwork.stats.views,
    likes: sum.likes + artwork.stats.likes,
    basket: sum.basket + artwork.stats.basketAdds,
    ar: sum.ar + artwork.stats.arTries,
  }), { views: 0, likes: 0, basket: 0, ar: 0 });

  return (
    <div className="page-shell !pb-10">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={onBack} className="round-action !bg-white"><ArrowLeft size={20} /></button>
        <div className="text-center"><p className="eyebrow">Creator workspace</p><h1 className="font-serif text-2xl">Artist studio</h1></div>
        <span className="count-badge">{artworks.length}/7</span>
      </div>

      {!creating && (
        <>
          <section className="rounded-[28px] bg-[#24362e] p-5 text-white">
            <div className="flex items-center justify-between"><div><p className="text-xs text-white/55">Published portfolio</p><h2 className="mt-1 font-serif text-3xl">{artworks.filter((artwork) => artwork.status === "published").length} artworks</h2></div><Sparkles className="text-[#d8c8ad]" /></div>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {[["Views", totals.views, Eye], ["Likes", totals.likes, Heart], ["Basket", totals.basket, ShoppingBag], ["AR tries", totals.ar, BarChart3]].map(([label, value, Icon]) => (
                <div key={String(label)} className="rounded-2xl bg-white/8 p-2 text-center"><Icon size={15} className="mx-auto mb-1 text-white/50" /><strong className="block text-sm">{String(value)}</strong><span className="text-[8px] uppercase tracking-wide text-white/45">{String(label)}</span></div>
              ))}
            </div>
          </section>
          <button onClick={() => setCreating(true)} disabled={artworks.length >= 7} className="primary-button mt-4 w-full disabled:opacity-40"><Plus size={18} /> Add artwork</button>
          {artworks.length >= 7 && <p className="mt-2 text-center text-xs text-amber-700">You have reached the current seven-artwork limit.</p>}

          <div className="mt-6 space-y-3">
            {artworks.map((artwork) => (
              <article key={artwork.id} className="flex gap-3 rounded-[22px] bg-white p-3 shadow-sm">
                <img src={artwork.images[0]} className="h-28 w-24 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1 py-1">
                  <div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${artwork.status === "published" ? "bg-[#dfe9df] text-[#355343]" : "bg-stone-100 text-stone-500"}`}>{artwork.status}</span><span className="text-xs text-stone-400">{artwork.stats.views} views</span></div>
                  <h3 className="mt-2 truncate font-serif text-xl">{artwork.title}</h3>
                  <p className="text-xs text-stone-500">{artwork.medium} · ${artwork.price}</p>
                  <div className="mt-3 flex gap-2"><button onClick={() => onOpen(artwork)} className="mini-button">Preview</button><button onClick={() => onAR(artwork)} className="mini-button">Create view</button></div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {creating && (
        <section className="rounded-[28px] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">New listing</p><h2 className="font-serif text-3xl">Add artwork</h2></div><button onClick={() => setCreating(false)} className="text-sm text-stone-500">Cancel</button></div>
          <button onClick={() => fileRef.current?.click()} className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[22px] border-2 border-dashed border-stone-200 bg-stone-50">
            {form.images[0] ? <img src={form.images[0]} className="h-full w-full object-cover" /> : <div className="text-center text-stone-400"><ImagePlus className="mx-auto mb-2" /><span className="text-sm">Upload cover image</span></div>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleImage(event.target.files?.[0])} />
          <div className="mt-4 space-y-3">
            <input className="field" placeholder="Artwork title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="field min-h-24 resize-none" placeholder="Story and description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3"><input className="field" placeholder="Medium" value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value })} /><input className="field" type="number" placeholder="Year" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} /></div>
            <div className="grid grid-cols-2 gap-3"><label className="field-label">Width, cm<input className="mt-1 w-full bg-transparent outline-none" type="number" value={form.width} onChange={(e) => setForm({ ...form, width: Number(e.target.value) })} /></label><label className="field-label">Height, cm<input className="mt-1 w-full bg-transparent outline-none" type="number" value={form.height} onChange={(e) => setForm({ ...form, height: Number(e.target.value) })} /></label></div>
            <label className="field-label">Price, USD<input className="mt-1 w-full bg-transparent text-lg font-semibold outline-none" type="number" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></label>
            <input className="field" placeholder="Tags, separated by commas" onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} />
          </div>
          {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => submit("draft")} className="secondary-button">Save draft</button><button onClick={() => submit("published")} className="primary-button">Publish</button></div>
        </section>
      )}
    </div>
  );
}
