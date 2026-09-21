import { Heart } from "lucide-react";
import { ArtworkCard } from "../components/ArtworkCard";
import { useStore } from "../store";
import type { Artwork } from "../types";
import { t, type Language } from "../i18n";

export function Liked({ language, onOpen }: { language: Language; onOpen: (artwork: Artwork) => void }) {
  const { state, currentUser, track } = useStore();
  const ids = state.likes[currentUser.id] ?? [];
  const artworks = state.artworks.filter((artwork) => ids.includes(artwork.id));
  return (
    <div className="page-shell">
      <div className="section-heading">
        <div><p className="eyebrow">Your collection</p><h1>{t(language, "liked")}</h1></div>
        <span className="count-badge">{artworks.length}</span>
      </div>
      {artworks.length ? (
        <div className="columns-2 gap-3 sm:gap-5">{artworks.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} onOpen={() => { track("artwork_opened", artwork.id); onOpen(artwork); }} />)}</div>
      ) : (
        <div className="empty-state min-h-[55dvh]"><Heart size={34} /><h2>Nothing saved yet</h2><p>{t(language, "emptyLikes")}</p></div>
      )}
    </div>
  );
}
