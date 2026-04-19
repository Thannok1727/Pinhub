import React, { useState, useRef, useEffect, useCallback } from "react";
import { Download, Link as LinkIcon, RefreshCw, Layers, Image as ImageIcon, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ScrapedData {
  titleA: string;
  titleB: string;
  image: string;
  url: string;
}

const PIN_WIDTH = 1440;
const PIN_HEIGHT = 2560; // 9:16 ratio (1440 / 9 * 16 = 2560)

function formatTitle(title: string): string {
  if (!title) return "Untitled Post";
  let cleaned = title.trim();
  // We now let the server handle the major cleaning
  if (cleaned.length > 120) cleaned = cleaned.substring(0, 117) + "...";
  return cleaned;
}

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScrapedData | null>(null);
  const [accentColor, setAccentColor] = useState("#4A6741");
  const [previews, setPreviews] = useState<{ a: string; b: string } | null>(null);
  
  // Customization
  const [fontSize, setFontSize] = useState(120);
  const [fontFamily, setFontFamily] = useState("'Playfair Display', serif");
  const [textColor, setTextColor] = useState("#FFFFFF");

  const timeoutRef = useRef<NodeJS.Timeout|null>(null);

  // Debounced Pin Generation
  const debouncedGenerate = useCallback((pinData: ScrapedData) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      generatePins(pinData);
    }, 150);
  }, [fontSize, fontFamily, textColor]);

  useEffect(() => {
    if (data) {
      debouncedGenerate(data);
    }
  }, [data, fontSize, fontFamily, textColor, debouncedGenerate]);

  const [status, setStatus] = useState<string | null>(null);

  const handleScrape = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setData(null);
    setPreviews(null);
    setStatus("Scraping Article Headlines...");

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to scrape");

      setStatus("Analyzing Design Palette...");
      const formattedData = {
        ...json,
        titleA: formatTitle(json.title || "Untitled Post"),
        titleB: formatTitle(json.title || "Untitled Post").toUpperCase(), 
      };
      
      setData(formattedData);
    } catch (err: any) {
      console.error("Fetch Error:", err);
      setError(err.message || "Something went wrong. Please check the URL.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const generatePins = async (pinData: ScrapedData) => {
    if (!pinData.image) return;
    setStatus("Painting High-Res Canvases...");
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/api/proxy-image?url=${encodeURIComponent(pinData.image)}`;

    img.onload = () => {
      const color = extractDominantColor(img);
      setAccentColor(color);
      const pinA = drawPin(pinData.titleA, img, color, "A");
      const pinB = drawPin(pinData.titleB, img, color, "B");
      setPreviews({ a: pinA, b: pinB });
      setStatus(null);
    };

    img.onerror = () => {
      setPreviews(null);
      setError("We found the article but couldn't process the cover image. Please check the URL or try another one.");
    };
  };

  const extractDominantColor = (img: HTMLImageElement): string => {
    try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return "#4A6741";
        canvas.width = 50; canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < imageData.length; i += 4) {
          r += imageData[i]; g += imageData[i+1]; b += imageData[i+2];
        }
        const count = imageData.length / 4;
        r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
        if ((r * 0.299 + g * 0.587 + b * 0.114) > 186) {
          return `rgb(${Math.max(0, r-40)}, ${Math.max(0, g-40)}, ${Math.max(0, b-40)})`;
        }
        return `rgb(${r}, ${g}, ${b})`;
    } catch {
        return "#4A6741";
    }
  };

  const drawPin = (title: string, img: HTMLImageElement, color: string, variation: "A" | "B"): string => {
    const canvas = document.createElement("canvas");
    canvas.width = PIN_WIDTH;
    canvas.height = PIN_HEIGHT;
    const ctx = canvas.getContext("2d")!;

    const topH = PIN_HEIGHT * 0.40;
    const midH = PIN_HEIGHT * 0.20;
    const botH = PIN_HEIGHT * 0.40;

    // Top
    if (variation === "B") drawCroppedImage(ctx, img, 0, 0, PIN_WIDTH, topH, 1.25);
    else drawCroppedImage(ctx, img, 0, 0, PIN_WIDTH, topH, 1.0);

    // Bar
    if (variation === "B") {
      const grad = ctx.createLinearGradient(0, topH, PIN_WIDTH, topH + midH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, adjustColor(color, -30));
      ctx.fillStyle = grad;
    } else ctx.fillStyle = color;
    ctx.fillRect(0, topH, PIN_WIDTH, midH);

    // Text
    ctx.save();
    ctx.fillStyle = textColor || "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    
    if (variation === "B") {
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 6;
    }

    const words = title.toUpperCase().split(" ");
    let lines = [];
    let currentLine = words[0];
    const charLimit = Math.max(8, Math.floor(1800 / fontSize));
    
    for (let i = 1; i < words.length; i++) {
        if (currentLine.length + words[i].length < charLimit) currentLine += " " + words[i];
        else { lines.push(currentLine); currentLine = words[i]; }
    }
    lines.push(currentLine);
    
    // Allow up to 3 lines for longer titles
    if (lines.length > 3) {
      lines = [lines[0], lines[1], lines.slice(2).join(" ")];
      const maxLastLineChars = Math.max(12, Math.floor(2500 / fontSize));
      if (lines[2].length > maxLastLineChars) lines[2] = lines[2].substring(0, maxLastLineChars - 3) + "...";
    }

    const lineHeight = fontSize * 1.25;
    const startY = topH + (midH / 2) - ((lines.length - 1) * lineHeight / 2);
    lines.forEach((line, idx) => ctx.fillText(line, PIN_WIDTH / 2, startY + (idx * lineHeight)));
    ctx.restore();

    // Bottom
    if (variation === "B") drawCroppedImage(ctx, img, 0, topH + midH, PIN_WIDTH, botH, 1.35, 0.7);
    else drawCroppedImage(ctx, img, 0, topH + midH, PIN_WIDTH, botH, 1.15, 0.65);

    // Branding
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "italic 44px serif";
    ctx.textAlign = "center";
    try { ctx.fillText(new URL(url).hostname.replace('www.', ''), PIN_WIDTH / 2, PIN_HEIGHT - 80); } catch { }
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.95);
  };

  const drawCroppedImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, zoom: number = 1.0, offsetY: number = 0.5) => {
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;
    let sw, sh, sx, sy;
    if (imgRatio > targetRatio) {
      sh = img.height / zoom; sw = sh * targetRatio;
      sx = (img.width - sw) / 2; sy = (img.height - sh) * offsetY;
    } else {
      sw = img.width / zoom; sh = sw / targetRatio;
      sx = (img.width - sw) / 2; sy = (img.height - sh) * offsetY;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    ctx.fillRect(x, y, w, h);
  };

  const adjustColor = (color: string, amount: number) => {
    const rgb = color.match(/\d+/g);
    if (!rgb) return color;
    const r = Math.max(0, Math.min(255, parseInt(rgb[0]) + amount));
    const g = Math.max(0, Math.min(255, parseInt(rgb[1]) + amount));
    const b = Math.max(0, Math.min(255, parseInt(rgb[2]) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const downloadPin = (dataUrl: string, name: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `pingenie-${name}-${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] font-sans text-[#1C1C1C]">
      {/* Precision Header */}
      <header className="px-6 py-8 sm:px-12 sm:py-10 flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-4 border-b border-black/5 bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-2">
          <span className="font-serif italic font-black text-3xl tracking-tighter">PinGenie</span>
          <span className="bg-[#4A6741] text-white text-[8px] px-1.5 py-0.5 rounded-sm uppercase font-black tracking-widest translate-y-[-10px] shadow-sm">Pro</span>
        </motion.div>
        <div className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">
          Neural-Palette Rendering
        </div>
      </header>

      <main className="flex flex-col lg:grid lg:grid-cols-[420px_1fr]">
        {/* Sidebar Controls */}
        <section className="bg-white p-6 sm:p-10 lg:h-[calc(100vh-100px)] lg:overflow-y-auto border-r border-black/5 flex flex-col gap-10">
          <div className="space-y-8">
            <h1 className="font-serif text-4xl leading-[1.1] font-medium tracking-tight">Generate traffic-stopping pins.</h1>
            
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 block">Blog Post URL</label>
              <div className="group relative">
                <input
                  type="url"
                  placeholder="https://modern.style/trends"
                  className="w-full pl-5 pr-12 py-4 bg-[#F9F9F9] border-2 border-transparent focus:border-[#4A6741]/20 rounded-xl text-sm outline-none transition-all placeholder:opacity-30"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScrape()}
                />
                <button 
                  onClick={handleScrape}
                  disabled={loading || !url}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A6741] hover:scale-110 active:scale-95 transition-transform disabled:opacity-0"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
                </button>
              </div>
              <button
                onClick={handleScrape}
                disabled={loading || !url}
                className="w-full py-5 bg-[#1C1C1C] text-white rounded-xl font-bold text-xs uppercase tracking-[0.3em] hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-black/10 disabled:opacity-30"
              >
                {loading ? "Engines Warming..." : "Synthesize Pin Set"}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-red-50 text-red-600 p-5 rounded-2xl text-xs font-semibold flex items-start gap-3 border border-red-100">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
              </motion.div>
            )}

            {data && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-10 pt-10 border-t border-black/5">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 block">Variation A Headline</label>
                    <textarea 
                      className="w-full p-4 bg-[#F9F9F9] font-serif text-lg border-none rounded-xl outline-none focus:ring-2 focus:ring-[#4A6741]/20 min-h-[100px] shadow-inner transition-all hover:bg-white"
                      value={data.titleA}
                      onChange={(e) => setData({ ...data, titleA: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 block">Variation B Headline</label>
                    <textarea 
                      className="w-full p-4 bg-[#F9F9F9] font-serif text-lg border-none rounded-xl outline-none focus:ring-2 focus:ring-[#4A6741]/20 min-h-[100px] shadow-inner transition-all hover:bg-white"
                      value={data.titleB}
                      onChange={(e) => setData({ ...data, titleB: e.target.value })}
                    />
                  </div>
                  <p className="text-[9px] opacity-30 uppercase font-bold tracking-widest text-center">Individual headlines for each pin style</p>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 block">Typeface</label>
                    <select 
                      className="w-full bg-[#F9F9F9] p-4 rounded-xl text-xs font-bold border-none focus:ring-1 focus:ring-[#4A6741]/20"
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                    >
                      <option value="'Playfair Display', serif">Playfair</option>
                      <option value="'Inter', sans-serif">Inter</option>
                      <option value="'Montserrat', sans-serif">Montserrat</option>
                      <option value="'Lato', sans-serif">Lato</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 flex justify-between">Size <span>{fontSize}</span></label>
                    <input 
                      type="range" min="60" max="240"
                      className="w-full accent-[#4A6741]"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 block">Palette Signature</label>
                  <div className="flex gap-3 items-center">
                    <div className="relative group">
                      <input 
                        type="color"
                        className="w-12 h-12 rounded-full border-4 border-white shadow-lg cursor-pointer p-0 bg-transparent overflow-hidden"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 ml-2">
                       {['#FFFFFF', '#000000', accentColor].map(c => (
                        <button 
                          key={c}
                          className="w-10 h-10 rounded-full border-2 border-white shadow-sm hover:scale-110 active:scale-95 transition-all"
                          style={{ backgroundColor: c }}
                          onClick={() => setTextColor(c)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Gallery Preview */}
        <section className="bg-[#E8EDE6]/30 p-8 sm:p-20 flex flex-col lg:flex-row items-center justify-center gap-16 lg:h-[calc(100vh-100px)] overflow-y-auto">
          <AnimatePresence mode="wait">
             {loading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6">
                    <div className="w-[340px] aspect-[2/3] bg-white/50 animate-pulse rounded-[32px] overflow-hidden flex flex-col">
                         <div className="h-[38%] bg-black/5" />
                         <div className="h-[24%] bg-black/10" />
                         <div className="h-[38%] bg-black/5" />
                    </div>
                    <p className="font-serif italic text-black/40">{status || "Visualizing your content..."}</p>
                </motion.div>
             ) : !previews ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-sm space-y-6 opacity-30">
                <div className="relative inline-block">
                    <ImageIcon size={80} className="mx-auto" strokeWidth={0.5} />
                    <Sparkles className="absolute -top-4 -right-4 animate-pulse" size={32} />
                </div>
                <p className="font-serif italic text-2xl tracking-tight">Paste a URL to begin the transformation.</p>
              </motion.div>
            ) : (
              <React.Fragment>
                {/* Variation A */}
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 flex flex-col items-center">
                  <div className="relative shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] bg-white aspect-[9/16] w-[320px] sm:w-[380px] lg:w-[440px] rounded-[40px] overflow-hidden">
                    <img src={previews.a} alt="Minimal" className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="flex flex-col items-center gap-4 w-full">
                    <button 
                      onClick={() => downloadPin(previews.a, "2K-Minimal")}
                      className="w-full max-w-[280px] bg-[#1C1C1C] text-white px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 hover:bg-black active:scale-95 transition-all"
                    >
                      <Download size={18} /> Download 2K HD
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-20">Minimalist Variation</span>
                  </div>
                </motion.div>

                {/* Variation B */}
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-6 flex flex-col items-center">
                  <div className="relative shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] bg-white aspect-[9/16] w-[320px] sm:w-[380px] lg:w-[440px] rounded-[40px] overflow-hidden">
                    <img src={previews.b} alt="Dynamic" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex flex-col items-center gap-4 w-full">
                    <button 
                      onClick={() => downloadPin(previews.b, "2K-Dynamic")}
                      className="w-full max-w-[280px] bg-[#1C1C1C] text-white px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 hover:bg-black active:scale-95 transition-all"
                    >
                      <Download size={18} /> Download 2K HD
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-20">Dynamic Variation</span>
                  </div>
                </motion.div>
              </React.Fragment>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
