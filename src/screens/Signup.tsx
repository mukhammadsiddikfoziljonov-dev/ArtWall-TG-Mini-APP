import { Camera, Check, Palette, ShieldCheck, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "../store";

export function Signup({ onComplete }: { onComplete: () => void }) {
  const { currentUser, isTelegram, completeSignup } = useStore();
  const invitedRole = useMemo<"buyer" | "artist">(() => window.Telegram?.WebApp?.initDataUnsafe?.start_param?.toLowerCase().startsWith("artist") ? "artist" : "buyer", []);
  const [name, setName] = useState(currentUser.name === "New visitor" ? "" : currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone ?? "");
  const [role, setRole] = useState<"buyer" | "artist">(invitedRole);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await completeSignup({ name, phone, role, consent: true });
    setSubmitting(false);
    if (!result.ok) return setError(result.message || "Unable to complete signup");
    onComplete();
  };

  return (
    <div className="min-h-[100dvh] bg-[#f4f1ea] px-4 py-6 text-[#20201d] sm:grid sm:place-items-center">
      <main className="mx-auto w-full max-w-md overflow-hidden rounded-[32px] bg-white shadow-[0_24px_80px_rgba(54,48,38,.14)]">
        <section className="bg-[#24362e] px-6 pb-7 pt-8 text-white">
          <div className="mb-6 flex items-center justify-between">
            <span className="font-serif text-3xl italic">ArtWall</span>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><Camera size={20} /></span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/55">Private beta · AR demo</p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05]">See art on your wall.</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">Sign up once, then use your live camera to place, resize and share an artwork in your room.</p>
        </section>

        <form onSubmit={submit} className="space-y-5 p-6">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[.14em] text-stone-500">Your name</label>
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} autoComplete="name" placeholder="Full name" required />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[.14em] text-stone-500">Phone number</label>
            <input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} minLength={7} maxLength={25} autoComplete="tel" inputMode="tel" placeholder="+998 90 123 45 67" required />
            <p className="mt-2 text-[11px] leading-4 text-stone-400">Used only for ArtWall beta follow-up.</p>
          </div>

          <fieldset>
            <legend className="mb-2 text-[11px] font-bold uppercase tracking-[.14em] text-stone-500">I am joining as</legend>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setRole("buyer")} className={`rounded-2xl border p-4 text-left transition ${role === "buyer" ? "border-[#667b6e] bg-[#edf2ed]" : "border-stone-200 bg-white"}`}>
                <ShoppingBag size={19} className="mb-4" /><strong className="block text-sm">Buyer</strong><small className="mt-1 block text-[11px] leading-4 text-stone-500">Discover and preview art</small>
              </button>
              <button type="button" onClick={() => setRole("artist")} className={`rounded-2xl border p-4 text-left transition ${role === "artist" ? "border-[#8a7353] bg-[#f3ede3]" : "border-stone-200 bg-white"}`}>
                <Palette size={19} className="mb-4" /><strong className="block text-sm">Artist</strong><small className="mt-1 block text-[11px] leading-4 text-stone-500">Show and preview artwork</small>
              </button>
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f7f5f0] p-4">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-[#24362e]" required />
            <span className="text-xs leading-5 text-stone-600">I agree that ArtWall stores my signup details and AR-demo usage for beta access and follow-up.</span>
          </label>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p>}
          <button disabled={submitting || !consent} className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-50"><Camera size={18} />{submitting ? "Creating access…" : "Unlock the AR demo"}</button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-stone-400"><ShieldCheck size={14} /><span>{isTelegram ? "Telegram identity verified" : "Secure browser demo session"}</span><Check size={13} /></div>
        </form>
      </main>
    </div>
  );
}

