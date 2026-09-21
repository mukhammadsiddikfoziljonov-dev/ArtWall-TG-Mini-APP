import { ArrowLeft, BarChart3, Camera, Eye, Heart, Image, ShoppingBag, Users } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "../store";
import type { BasketItem } from "../types";

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const { state } = useStore();
  const metrics = useMemo(() => {
    const artists = state.users.filter((user) => user.roles.includes("artist"));
    const basketUsers = (Object.values(state.baskets) as BasketItem[][]).filter((items) => items.length).length;
    return {
      users: state.users.length,
      buyers: state.users.filter((user) => user.roles.includes("buyer")).length,
      artistCount: artists.length,
      artworks: state.artworks.length,
      published: state.artworks.filter((artwork) => artwork.status === "published").length,
      views: state.artworks.reduce((sum, artwork) => sum + artwork.stats.views, 0),
      uniqueViews: new Set(state.artworks.flatMap((artwork) => artwork.stats.uniqueViewers)).size,
      likes: state.artworks.reduce((sum, artwork) => sum + artwork.stats.likes, 0),
      basketAdds: state.artworks.reduce((sum, artwork) => sum + artwork.stats.basketAdds, 0),
      basketUsers,
      ar: state.artworks.reduce((sum, artwork) => sum + artwork.stats.arTries, 0),
      shares: state.artworks.reduce((sum, artwork) => sum + artwork.stats.shares, 0),
      saved: state.savedViews.length,
      artists,
    };
  }, [state]);
  const top = [...state.artworks].sort((a, b) => b.stats.views - a.stats.views).slice(0, 5);

  const cards = [
    ["Users", metrics.users, Users, "#e7ded0"], ["Artists", metrics.artistCount, Image, "#dfe9df"],
    ["Artworks", metrics.artworks, BarChart3, "#ece7f4"], ["Views", metrics.views, Eye, "#e2edf1"],
    ["Likes", metrics.likes, Heart, "#f6ded9"], ["In baskets", metrics.basketAdds, ShoppingBag, "#efe7d3"],
    ["AR tries", metrics.ar, Camera, "#dce9e2"], ["Saved views", metrics.saved, Image, "#e6e1f0"],
  ] as const;

  return (
    <div className="page-shell !pb-10">
      <div className="mb-6 flex items-center justify-between"><button onClick={onBack} className="round-action !bg-white"><ArrowLeft size={20} /></button><div className="text-center"><p className="eyebrow">Live platform</p><h1 className="font-serif text-2xl">Admin overview</h1></div><span className="h-10 w-10" /></div>
      <section className="rounded-[28px] bg-[#20201d] p-5 text-white">
        <p className="text-xs text-white/50">Marketplace pulse</p>
        <h2 className="mt-1 font-serif text-3xl">Everything in one view.</h2>
        <div className="mt-5 flex gap-5 text-sm"><span><strong className="block text-xl">{metrics.uniqueViews}</strong><small className="text-white/45">unique viewers</small></span><span><strong className="block text-xl">{metrics.basketUsers}</strong><small className="text-white/45">basket users</small></span><span><strong className="block text-xl">{metrics.shares}</strong><small className="text-white/45">shares</small></span></div>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {cards.map(([label, value, Icon, color]) => <div key={label} className="rounded-[22px] bg-white p-4 shadow-sm"><span className="mb-5 grid h-9 w-9 place-items-center rounded-xl text-[#30302b]" style={{ background: color }}><Icon size={17} /></span><strong className="block font-serif text-3xl">{value}</strong><span className="text-xs text-stone-500">{label}</span></div>)}
      </div>
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-2xl">Top artworks</h2><span className="text-xs text-stone-400">By total views</span></div>
        <div className="space-y-2">
          {top.map((artwork, index) => <div key={artwork.id} className="flex items-center gap-3 rounded-2xl bg-white p-3"><span className="w-5 text-center font-serif text-xl text-stone-300">{index + 1}</span><img src={artwork.images[0]} className="h-12 w-12 rounded-xl object-cover" /><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{artwork.title}</strong><span className="text-xs text-stone-400">{artwork.artistName}</span></div><div className="text-right"><strong className="block text-sm">{artwork.stats.views}</strong><span className="text-[9px] uppercase text-stone-400">views</span></div></div>)}
        </div>
      </section>
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-2xl">Artist capacity</h2><span className="text-xs text-stone-400">{metrics.artists.length} artists</span></div>
        <div className="space-y-2">{metrics.artists.map((artist) => { const count = state.artworks.filter((artwork) => artwork.artistId === artist.id).length; return <div key={artist.id} className="rounded-2xl bg-white p-4"><div className="flex justify-between text-sm"><strong>{artist.name}</strong><span>{count}/5</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#667b6e]" style={{ width: `${(count / 5) * 100}%` }} /></div></div>; })}</div>
      </section>
    </div>
  );
}

