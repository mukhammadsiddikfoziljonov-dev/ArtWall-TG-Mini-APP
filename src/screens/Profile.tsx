import { BarChart3, ChevronRight, Edit3, Image, MapPin, Palette, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useStore } from "../store";
import { t, type Language } from "../i18n";
import type { Role } from "../types";

export function Profile({ language, onArtist, onAdmin }: { language: Language; onArtist: () => void; onAdmin: () => void }) {
  const { currentUser, state, isTelegram, setDemoRole, updateProfile } = useStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: currentUser.name, bio: currentUser.bio ?? "", location: currentUser.location ?? "", social: currentUser.social ?? "" });
  const views = state.savedViews.filter((view) => view.userId === currentUser.id);

  const save = () => {
    updateProfile(form);
    setEditing(false);
  };

  return (
    <div className="page-shell">
      {!isTelegram && (
        <div className="mb-5 rounded-2xl border border-[#d7ccb9] bg-[#fff9ec] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#8a6b35]">Preview identity</p>
          <div className="grid grid-cols-3 gap-2">
            {(["buyer", "artist", "admin"] as Role[]).map((role) => <button key={role} onClick={() => setDemoRole(role)} className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize ${currentUser.roles.includes(role) && (role === "admin" || currentUser.id === `preview-${role}`) ? "bg-[#20201d] text-white" : "bg-white text-stone-600"}`}>{role}</button>)}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-[#8a6b35]">Telegram supplies this identity automatically in production.</p>
        </div>
      )}

      <section className="rounded-[30px] bg-[#24362e] p-6 text-white">
        <div className="flex items-center gap-4">
          {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} className="h-20 w-20 rounded-full object-cover ring-4 ring-white/10" /> : <div className="grid h-20 w-20 place-items-center rounded-full bg-[#d8c8ad] font-serif text-3xl text-[#24362e]">{currentUser.name.charAt(0)}</div>}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-3xl">{currentUser.name}</h1>
            <p className="mt-1 text-sm text-white/60">@{currentUser.username ?? "telegram_user"}</p>
            {currentUser.location && <p className="mt-2 flex items-center gap-1 text-xs text-white/55"><MapPin size={13} /> {currentUser.location}</p>}
          </div>
          <button onClick={() => setEditing(!editing)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Edit3 size={17} /></button>
        </div>
        {currentUser.bio && <p className="mt-5 text-sm leading-6 text-white/75">{currentUser.bio}</p>}
      </section>

      {editing && (
        <div className="mt-4 space-y-3 rounded-[24px] bg-white p-4 shadow-sm">
          <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Display name" />
          <textarea className="field min-h-24 resize-none" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Short biography" />
          <input className="field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" />
          <input className="field" value={form.social} onChange={(e) => setForm({ ...form, social: e.target.value })} placeholder="Social link" />
          <button onClick={save} className="primary-button w-full">Save profile</button>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {currentUser.roles.includes("artist") && <button onClick={onArtist} className="menu-row"><span className="menu-icon bg-[#e7ded0] text-[#765c38]"><Palette size={18} /></span><span className="flex-1 text-left"><strong>{t(language, "artistStudio")}</strong><small>Manage profile and up to 5 artworks</small></span><ChevronRight size={18} /></button>}
        {currentUser.roles.includes("admin") && <button onClick={onAdmin} className="menu-row"><span className="menu-icon bg-[#dfe9df] text-[#355343]"><BarChart3 size={18} /></span><span className="flex-1 text-left"><strong>{t(language, "admin")}</strong><small>Platform activity and performance</small></span><ChevronRight size={18} /></button>}
        <div className="menu-row"><span className="menu-icon bg-[#ece7f4] text-[#625176]"><ShieldCheck size={18} /></span><span className="flex-1"><strong>Telegram account</strong><small>{isTelegram ? "Verified Telegram session" : "Preview mode"}</small></span></div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-2xl">{t(language, "savedViews")}</h2><span className="count-badge">{views.length}</span></div>
        {views.length ? <div className="grid grid-cols-2 gap-3">{views.map((view) => <img key={view.id} src={view.imageDataUrl} className="aspect-[4/5] w-full rounded-2xl object-cover" />)}</div> : <div className="empty-state py-10"><Image size={26} /><p>Your saved wall previews will appear here.</p></div>}
      </div>
    </div>
  );
}

