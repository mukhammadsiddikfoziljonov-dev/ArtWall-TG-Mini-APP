import { ArrowLeft, Camera, Check, Heart, ImagePlus, Maximize2, Move, RotateCcw, RotateCw, Share2, ShoppingBag, SlidersHorizontal, VideoOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import * as htmlToImage from "html-to-image";
import type { Artwork } from "../types";
import { useStore } from "../store";
import { t, type Language } from "../i18n";

type Mode = "move" | "rotate" | "scale";
type Panel = "size" | "frame" | "room" | null;

export function ARStudio({ artwork, language, onBack, demoMode = false }: { artwork: Artwork; language: Language; onBack: () => void; demoMode?: boolean }) {
  const { addToBasket, basket, isLiked, toggleLike, saveView, track } = useStore();
  const [mode, setMode] = useState<Mode>("move");
  const [panel, setPanel] = useState<Panel>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [width, setWidth] = useState(artwork.width);
  const [height, setHeight] = useState(artwork.height);
  const [frameColor, setFrameColor] = useState("#241f1a");
  const [material, setMaterial] = useState<"solid" | "wood" | "metal">("wood");
  const [frameThickness, setFrameThickness] = useState(4);
  const [matting, setMatting] = useState(3);
  const [roomImage, setRoomImage] = useState("https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=85");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [frozenFrame, setFrozenFrame] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [toast, setToast] = useState("");
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const roomInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef({ x: 0, y: 0, px: 0, py: 0, rx: 0, ry: 0, scale: 1 });
  const trackedStartRef = useRef(false);
  const added = !demoMode && basket.some((item) => item.artworkId === artwork.id);
  const liked = !demoMode && isLiked(artwork.id);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setFrozenFrame("");
  };

  const startCamera = async () => {
    setCameraError("");
    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      stopCamera();
      streamRef.current = stream;
      setCameraActive(true);
      track("ar_camera_started", demoMode ? undefined : artwork.id);
    } catch {
      setCameraError("Camera permission was not granted. Upload a room photo instead.");
    } finally {
      setCameraStarting(false);
    }
  };

  useEffect(() => {
    if (!trackedStartRef.current) {
      trackedStartRef.current = true;
      track("ar_started", demoMode ? undefined : artwork.id);
    }
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [artwork.id, demoMode]);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [cameraActive]);

  const freezeCamera = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return "";
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const capture = async () => {
    const frame = cameraActive ? freezeCamera() : "";
    if (frame) setFrozenFrame(frame);
    setCapturing(true);
    setPanel(null);
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    try {
      if (!stageRef.current) return "";
      return await htmlToImage.toJpeg(stageRef.current, { quality: 0.9, pixelRatio: 1.25, skipFonts: true, cacheBust: true });
    } finally {
      setCapturing(false);
      setFrozenFrame("");
    }
  };

  const save = async () => {
    const image = await capture();
    if (!image) return;
    if (demoMode) {
      const link = document.createElement("a");
      link.download = "artwall-ar-demo.jpg";
      link.href = image;
      link.click();
      track("ar_view_saved");
      notify("View saved to your device");
    } else {
      saveView(artwork.id, image);
      notify("View saved to your profile");
    }
  };

  const share = async () => {
    const image = await capture();
    if (!image) return;
    const blob = await fetch(image).then((response) => response.blob());
    const file = new File([blob], `${artwork.title.replace(/\s+/g, "-").toLowerCase()}-artwall.jpg`, { type: "image/jpeg" });
    const shareData = { title: artwork.title, text: `See ${artwork.title} by ${artwork.artistName} on my wall.`, files: [file] };
    try {
      if (navigator.canShare?.(shareData)) await navigator.share(shareData);
      else {
        const link = document.createElement("a");
        link.download = file.name;
        link.href = image;
        link.click();
      }
      track("ar_view_shared", demoMode ? undefined : artwork.id);
    } catch {
      notify("Sharing was cancelled");
    }
  };

  const handleRoom = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { stopCamera(); setRoomImage(String(reader.result)); setPanel(null); };
    reader.readAsDataURL(file);
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, px: position.x, py: position.y, rx: rotation.x, ry: rotation.y, scale };
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    if (mode === "move") setPosition({ x: dragRef.current.px + dx, y: dragRef.current.py + dy });
    if (mode === "rotate") setRotation({ x: Math.max(-65, Math.min(65, dragRef.current.rx - dy * 0.35)), y: dragRef.current.ry + dx * 0.35 });
    if (mode === "scale") setScale(Math.max(0.45, Math.min(2.1, dragRef.current.scale + (dx - dy) * 0.004)));
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 }); setRotation({ x: 0, y: 0 }); setScale(1); setWidth(artwork.width); setHeight(artwork.height);
  };
  const materialBackground = material === "wood"
    ? `linear-gradient(90deg,rgba(255,255,255,.08),rgba(0,0,0,.18)), repeating-linear-gradient(4deg,${frameColor},${frameColor} 4px,#5c4634 5px,#32261d 7px)`
    : material === "metal" ? `linear-gradient(135deg,#fafafa 0%,${frameColor} 35%,#111 55%,${frameColor} 80%,#fff 100%)` : frameColor;
  const displayWidth = Math.min(340, Math.max(120, width * 3.25)) * scale;
  const displayHeight = displayWidth * (height / width);

  return (
    <div ref={stageRef} className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      {cameraActive && !frozenFrame ? <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" /> : <img src={frozenFrame || roomImage} className="absolute inset-0 h-full w-full object-cover" alt="Room" />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/35" />

      {!capturing && <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button onClick={() => { stopCamera(); onBack(); }} className="round-action"><ArrowLeft size={20} /></button>
        <div className="rounded-full bg-black/35 px-4 py-2 text-center backdrop-blur-xl"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/55">On your wall</p><p className="max-w-[190px] truncate font-serif text-base">{artwork.title}</p></div>
        <button onClick={reset} className="round-action" aria-label="Reset"><RotateCcw size={18} /></button>
      </header>}

      <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden touch-none">
        <div
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          className="relative cursor-grab touch-none active:cursor-grabbing"
          style={{ width: displayWidth, height: displayHeight, transform: `translate3d(${position.x}px,${position.y}px,0) perspective(900px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`, transformStyle: "preserve-3d", transition: dragging ? "none" : "width .25s,height .25s" }}
        >
          <div className="h-full w-full shadow-[0_28px_55px_rgba(0,0,0,.42)]" style={{ padding: frameThickness * 1.5, background: materialBackground }}>
            <div className="h-full w-full bg-[#f5f1e8]" style={{ padding: matting * 1.5 }}>
              <img src={artwork.images[0]} alt={artwork.title} draggable={false} className="h-full w-full select-none object-cover" />
            </div>
          </div>
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-3 py-1 text-[9px] font-semibold tracking-wider backdrop-blur-md">{width} × {height} cm · {Math.round(scale * 100)}%</div>
        </div>
      </div>

      {!capturing && demoMode && !cameraActive && <button onClick={startCamera} disabled={cameraStarting} className="absolute bottom-32 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-3 text-xs font-bold text-[#24362e] shadow-xl disabled:opacity-60"><Camera size={17} />{cameraStarting ? "Starting camera…" : "Use live camera"}</button>}

      {!capturing && <div className="absolute left-1/2 top-24 z-30 flex -translate-x-1/2 rounded-full bg-black/45 p-1 backdrop-blur-xl">
        {([["move", Move], ["rotate", RotateCw], ["scale", Maximize2]] as const).map(([item, Icon]) => <button key={item} onClick={() => setMode(item)} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${mode === item ? "bg-white text-black" : "text-white/65"}`}><Icon size={14} /> {item}</button>)}
      </div>}

      {toast && <div className="absolute left-1/2 top-40 z-50 -translate-x-1/2 rounded-full bg-[#24362e] px-4 py-2 text-xs shadow-xl"><Check size={14} className="mr-1 inline" />{toast}</div>}

      {!capturing && <div className="absolute inset-x-3 bottom-[86px] z-40">
        {panel && <div className="mb-3 rounded-[26px] bg-white p-5 text-[#20201d] shadow-2xl">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-serif text-2xl">{panel === "size" ? "Size & angle" : panel === "frame" ? "Frame" : "Your room"}</h3><button onClick={() => setPanel(null)} className="p-1 text-stone-400"><X size={18} /></button></div>
          {panel === "size" && <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Range label="Width" value={width} min={20} max={150} unit="cm" onChange={setWidth} />
            <Range label="Height" value={height} min={20} max={150} unit="cm" onChange={setHeight} />
            <Range label="Scale" value={Math.round(scale * 100)} min={45} max={210} unit="%" onChange={(value) => setScale(value / 100)} />
            <Range label="Horizontal tilt" value={Math.round(rotation.y)} min={-60} max={60} unit="°" onChange={(value) => setRotation({ ...rotation, y: value })} />
          </div>}
          {panel === "frame" && <div>
            <div className="mb-4 flex gap-3">{["#241f1a", "#d4b890", "#ffffff", "#151515"].map((color) => <button key={color} onClick={() => setFrameColor(color)} className={`h-9 w-9 rounded-full ring-offset-2 ${frameColor === color ? "ring-2 ring-[#667b6e]" : "ring-1 ring-stone-200"}`} style={{ background: color }} />)}</div>
            <div className="mb-4 grid grid-cols-3 gap-2">{(["solid", "wood", "metal"] as const).map((item) => <button key={item} onClick={() => setMaterial(item)} className={`rounded-xl py-2 text-xs font-semibold capitalize ${material === item ? "bg-[#24362e] text-white" : "bg-stone-100"}`}>{item}</button>)}</div>
            <div className="grid grid-cols-2 gap-4"><Range label="Frame" value={frameThickness} min={1} max={10} unit="cm" onChange={setFrameThickness} /><Range label="Matting" value={matting} min={0} max={15} unit="cm" onChange={setMatting} /></div>
          </div>}
          {panel === "room" && <div className="space-y-2">
            <button onClick={cameraActive ? stopCamera : startCamera} className="primary-button w-full"><Camera size={17} /> {cameraActive ? "Stop camera" : cameraStarting ? "Starting camera…" : t(language, "liveCamera")}</button>
            <button onClick={() => roomInputRef.current?.click()} className="secondary-button w-full"><ImagePlus size={17} /> {t(language, "uploadRoom")}</button>
            <input ref={roomInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => handleRoom(event.target.files?.[0])} />
            {cameraError && <p className="pt-2 text-xs leading-5 text-red-600">{cameraError}</p>}
          </div>}
        </div>}
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPanel(panel === "size" ? null : "size")} className="glass-action"><SlidersHorizontal size={18} /><span>Size</span></button>
          <button onClick={() => setPanel(panel === "frame" ? null : "frame")} className="glass-action"><Maximize2 size={18} /><span>Frame</span></button>
          <button onClick={() => setPanel(panel === "room" ? null : "room")} className="glass-action"><Camera size={18} /><span>Room</span></button>
        </div>
      </div>}

      {!capturing && <footer className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t border-white/10 bg-black/45 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        {!demoMode && <button onClick={() => toggleLike(artwork.id)} className={`ar-footer-button ${liked ? "!bg-[#ff6b59]" : ""}`} aria-label="Like"><Heart size={18} fill={liked ? "currentColor" : "none"} /></button>}
        <button onClick={save} className="ar-footer-button"><Check size={18} /><span>{t(language, "save")}</span></button>
        <button onClick={share} className="ar-footer-button"><Share2 size={18} /><span>{t(language, "share")}</span></button>
        {!demoMode && <button onClick={() => { addToBasket(artwork.id); notify("Added to basket"); }} className={`ar-footer-button ${added ? "!bg-[#667b6e]" : ""}`}><ShoppingBag size={18} /><span>{added ? t(language, "added") : "Basket"}</span></button>}
        {cameraActive && <button onClick={stopCamera} className="ar-footer-button" aria-label="Stop camera"><VideoOff size={18} /></button>}
      </footer>}
    </div>
  );
}

function Range({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-2 flex justify-between text-[11px] font-semibold text-stone-500"><span>{label}</span><span>{value}{unit}</span></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-[#667b6e]" /></label>;
}

