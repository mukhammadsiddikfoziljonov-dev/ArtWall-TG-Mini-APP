import { Heart, MoveUpRight } from "lucide-react";
import type { Artwork } from "../types";
import { useStore } from "../store";

export function ArtworkCard({ artwork, onOpen }: { key?: string; artwork: Artwork; onOpen: () => void }) {
  const { isLiked, toggleLike } = useStore();
  const liked = isLiked(artwork.id);

  return (
    <article className="group break-inside-avoid mb-5">
      <div className="relative overflow-hidden rounded-[22px] bg-stone-200">
        <button onClick={onOpen} className="block w-full text-left" aria-label={`Open ${artwork.title}`}>
          <img
            src={artwork.images[0]}
            alt={artwork.title}
            className="w-full object-cover transition duration-700 group-hover:scale-[1.03]"
            style={{ aspectRatio: artwork.width / artwork.height }}
          />
        </button>
        <button
          onClick={() => toggleLike(artwork.id)}
          aria-label={liked ? "Unlike artwork" : "Like artwork"}
          className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full backdrop-blur-xl transition active:scale-90 ${liked ? "bg-[#ff6b59] text-white" : "bg-white/85 text-[#20201d]"}`}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
      <button onClick={onOpen} className="flex w-full items-start justify-between gap-3 pt-3 text-left">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-[19px] leading-tight text-[#20201d]">{artwork.title}</h3>
          <p className="mt-1 truncate text-xs text-stone-500">{artwork.artistName} · {artwork.medium}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-sm font-semibold">
          ${artwork.price.toLocaleString()}
          <MoveUpRight size={14} className="text-stone-400" />
        </div>
      </button>
    </article>
  );
}
