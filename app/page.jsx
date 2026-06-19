"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const VERSION = "v11 Transparent Logo + Footer Fix";

const defaultSettings = {
  industry: "auto",
  enhancement: "premium",
  cleanup: "strong",
  outputSize: "2200",
  logoScale: "100",
  footerScale: "100",
  customSlogan: "",
  showSlogan: "yes",
};

const FALLBACK_SLOGANS = {
  hvac: [
    "Precision Installation, Built to Last",
    "Comfort in Every Space, Quality in Every Detail",
    "Professional HVAC Solutions, Built to Last"
  ],
  solar: [
    "Clean Energy, Built for Tomorrow",
    "Harvesting the Sun, Powering Everyday",
    "Smart Power for Modern Living"
  ],
  mep: [
    "Reliable Systems, Professional Execution",
    "Power, Control, and Performance",
    "Engineering Details That Last"
  ],
  lighting: [
    "Beautiful Pathways, Professionally Illuminated",
    "Lighting the Way with Elegance and Care"
  ],
  inventory: [
    "Quality Units, Ready to Deliver",
    "Stocked for Every Cooling Solution"
  ],
  team: [
    "People Behind Smart Energy",
    "Learning Today, Leading Tomorrow"
  ],
  auto: [
    "Quality Work, Delivered with Confidence",
    "Professional Solutions for Real Projects",
    "Clean Execution, Reliable Performance"
  ]
};

function pickFallbackSlogan(industry) {
  const list = FALLBACK_SLOGANS[industry] || FALLBACK_SLOGANS.auto;
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(v, min = 0, max = 255) { return Math.max(min, Math.min(max, v)); }
function mb(bytes) { return bytes ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : "-"; }

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image. Try JPG/PNG instead of HEIC.")); };
    image.src = url;
  });
}

function loadImageFromUrl(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function profile(mode) {
  if (mode === "natural") return { low: .008, high: .992, exposure: 1.018, contrast: 1.08, sat: 1.05, vib: .12, shadows: 8, highlights: -5, warmth: .8, sharp: .32, blur: 1.05, dehaze: .03 };
  if (mode === "pro") return { low: .006, high: .994, exposure: 1.035, contrast: 1.15, sat: 1.09, vib: .20, shadows: 14, highlights: -9, warmth: 1.0, sharp: .58, blur: 1.25, dehaze: .05 };
  return { low: .004, high: .996, exposure: 1.052, contrast: 1.22, sat: 1.12, vib: .28, shadows: 20, highlights: -14, warmth: 1.2, sharp: .82, blur: 1.45, dehaze: .07 };
}

function percentiles(data, lowClip, highClip) {
  const hist = new Uint32Array(256);
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    hist[Math.round(.2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2])]++;
  }
  let acc = 0, low = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * lowClip) { low = i; break; } }
  acc = 0; let high = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * highClip) { high = i; break; } }
  if (high - low < 70) { low = Math.max(0, low - 14); high = Math.min(255, high + 14); }
  return { low, high };
}

function enhance(ctx, w, h, mode) {
  const p = profile(mode);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const { low, high } = percentiles(d, p.low, p.high);
  const range = Math.max(1, high - low);

  for (let i = 0; i < d.length; i += 4) {
    let r = ((d[i] - low) * 255) / range;
    let g = ((d[i + 1] - low) * 255) / range;
    let b = ((d[i + 2] - low) * 255) / range;

    r *= p.exposure; g *= p.exposure; b *= p.exposure;
    let lum = .2126 * r + .7152 * g + .0722 * b;

    const sh = Math.max(0, 1 - lum / 155);
    const hi = Math.max(0, (lum - 188) / 67);
    r += p.shadows * sh + p.highlights * hi;
    g += p.shadows * sh + p.highlights * hi;
    b += p.shadows * sh + p.highlights * hi;

    // dehaze/local contrast style, without AI look
    lum = .2126 * r + .7152 * g + .0722 * b;
    r = lum + (r - lum) * (1 + p.dehaze);
    g = lum + (g - lum) * (1 + p.dehaze);
    b = lum + (b - lum) * (1 + p.dehaze);

    r = (r - 128) * p.contrast + 128;
    g = (g - 128) * p.contrast + 128;
    b = (b - 128) * p.contrast + 128;

    r += p.warmth; b -= p.warmth * .55;
    lum = .2126 * r + .7152 * g + .0722 * b;
    const maxc = Math.max(r, g, b), avg = (r + g + b) / 3;
    const satAmount = maxc === 0 ? 0 : (maxc - avg) / maxc;
    const vib = 1 + p.vib * (1 - satAmount);
    r = lum + (r - lum) * p.sat * vib;
    g = lum + (g - lum) * p.sat * vib;
    b = lum + (b - lum) * p.sat * vib;

    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
  }
  ctx.putImageData(img, 0, 0);
  return p;
}

function unsharp(ctx, w, h, amount, radius) {
  if (!amount) return;
  const original = ctx.getImageData(0, 0, w, h);
  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = w; blurCanvas.height = h;
  const bctx = blurCanvas.getContext("2d", { alpha: false });
  bctx.filter = `blur(${radius}px)`;
  bctx.drawImage(ctx.canvas, 0, 0);
  bctx.filter = "none";
  const blurred = bctx.getImageData(0, 0, w, h);
  const od = original.data, bd = blurred.data;
  for (let i = 0; i < od.length; i += 4) {
    od[i] = clamp(od[i] + (od[i] - bd[i]) * amount);
    od[i + 1] = clamp(od[i + 1] + (od[i + 1] - bd[i + 1]) * amount);
    od[i + 2] = clamp(od[i + 2] + (od[i + 2] - bd[i + 2]) * amount);
  }
  ctx.putImageData(original, 0, 0);
}

// Reduces tiny wall/sky dust speckles. It does not fake-remove large objects.
function reduceSpeckles(ctx, w, h, strength) {
  if (strength === "light") return;
  const img = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(img.data);
  const d = img.data;
  const step = strength === "strong" ? 1 : 2;
  const threshold = strength === "strong" ? 42 : 55;
  for (let y = 1; y < h - 1; y += step) {
    for (let x = 1; x < w - 1; x += step) {
      const i = (y * w + x) * 4;
      const lum = .2126 * src[i] + .7152 * src[i + 1] + .0722 * src[i + 2];
      const sat = Math.max(src[i], src[i + 1], src[i + 2]) - Math.min(src[i], src[i + 1], src[i + 2]);
      if (sat > 34) continue;
      const ids = [i - 4, i + 4, i - w * 4, i + w * 4];
      let ar = 0, ag = 0, ab = 0, al = 0;
      for (const n of ids) { ar += src[n]; ag += src[n + 1]; ab += src[n + 2]; al += .2126 * src[n] + .7152 * src[n + 1] + .0722 * src[n + 2]; }
      ar /= 4; ag /= 4; ab /= 4; al /= 4;
      if (Math.abs(lum - al) > threshold && al > 95) { d[i] = ar; d[i + 1] = ag; d[i + 2] = ab; }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function wrap(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > maxWidth && line) { lines.push(line); line = word; if (lines.length >= maxLines - 1) break; }
    else line = t;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function fitText(ctx, text, maxWidth, startSize, weight = 800) {
  let size = startSize;
  do { ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`; if (ctx.measureText(text).width <= maxWidth) break; size -= 1; } while (size > 10);
  return size;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}

function pin(ctx, x, y, s, c) {
  ctx.save(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y - s*.1, s*.3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, y+s*.45); ctx.lineTo(x-s*.22, y+s*.1); ctx.lineTo(x+s*.22, y+s*.1); ctx.closePath(); ctx.fill(); ctx.fillStyle="#005696"; ctx.beginPath(); ctx.arc(x, y-s*.1, s*.1, 0, Math.PI*2); ctx.fill(); ctx.restore();
}
function phone(ctx, x, y, s, c) {
  ctx.save(); ctx.strokeStyle=c; ctx.lineWidth=Math.max(3,s*.12); ctx.lineCap="round"; ctx.lineJoin="round"; ctx.beginPath(); ctx.moveTo(x-s*.18,y-s*.25); ctx.quadraticCurveTo(x-s*.38,y,x-s*.08,y+s*.30); ctx.lineTo(x+s*.18,y+s*.14); ctx.stroke(); ctx.restore();
}

function drawFooterLandscape(ctx, w, h, fh) {
  const blue="#005696", deep="#003f7d", orange="#f25b22", white="#fff";
  const y = h - fh, os = w * .62, diag = w * .085;
  ctx.save();
  ctx.fillStyle = deep; ctx.fillRect(0, y, w, fh);
  ctx.fillStyle = blue; ctx.fillRect(0, y, w * .68, fh);
  ctx.fillStyle = orange; ctx.beginPath(); ctx.moveTo(os + diag, y); ctx.lineTo(w, y); ctx.lineTo(w, h); ctx.lineTo(os, h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = white; ctx.lineWidth = Math.max(5, w*.004); ctx.beginPath(); ctx.moveTo(os + diag, y); ctx.lineTo(os, h); ctx.stroke();
  const cy = y + fh*.52, icon = Math.max(26, fh*.31);
  ctx.textBaseline = "middle"; ctx.fillStyle = white;
  const fs = fitText(ctx, "Mobile: 03 715 512", w*.20, Math.max(20, fh*.22), 700);
  ctx.font = `700 ${fs}px Arial, Helvetica, sans-serif`;
  const x1 = w*.065; ctx.beginPath(); ctx.arc(x1, cy, icon*.55, 0, Math.PI*2); ctx.fillStyle = white; ctx.fill(); pin(ctx, x1, cy, icon*.95, blue); ctx.fillStyle = white; ctx.fillText("Lebanon", w*.095, cy);
  const x2 = w*.34; ctx.beginPath(); ctx.arc(x2, cy, icon*.55, 0, Math.PI*2); ctx.fillStyle = white; ctx.fill(); phone(ctx, x2, cy, icon*.95, blue); ctx.fillStyle = white; ctx.fillText("Mobile: 03 715 512", w*.37, cy);
  const service = "HVAC SOLAR MEP SOLUTIONS"; const sfs = fitText(ctx, service, w*.31, Math.max(19, fh*.215), 800);
  ctx.font = `800 ${sfs}px Arial, Helvetica, sans-serif`; ctx.textAlign="right"; ctx.fillText(service, w*.965, cy); ctx.textAlign="left";
  ctx.restore();
}

function drawFooterPortrait(ctx, w, h, fh) {
  const blue = "#005696", orange = "#f25b22", white = "#fff";
  const y = h - fh;

  // Portrait footer uses two clean rows:
  // top blue row = location + mobile
  // bottom orange row = services
  const topH = fh * 0.62;
  const bottomH = fh - topH;

  ctx.save();
  ctx.fillStyle = blue;
  ctx.fillRect(0, y, w, topH);

  ctx.fillStyle = orange;
  ctx.fillRect(0, y + topH, w, bottomH);

  ctx.fillStyle = white;
  ctx.textBaseline = "middle";

  const cy = y + topH * 0.52;
  const icon = Math.max(18, Math.min(30, topH * 0.31));

  // Lebanon group
  const locText = "Lebanon";
  let locSize = fitText(ctx, locText, w * 0.23, Math.max(14, topH * 0.25), 700);
  ctx.font = `700 ${locSize}px Arial, Helvetica, sans-serif`;
  const x1 = w * 0.070;
  ctx.beginPath();
  ctx.arc(x1, cy, icon * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = white;
  ctx.fill();
  pin(ctx, x1, cy, icon * 0.90, blue);
  ctx.fillStyle = white;
  ctx.fillText(locText, w * 0.115, cy);

  // Mobile group
  const phoneText = "Mobile: 03 715 512";
  let phoneSize = fitText(ctx, phoneText, w * 0.37, Math.max(13, topH * 0.23), 700);
  ctx.font = `700 ${phoneSize}px Arial, Helvetica, sans-serif`;
  const x2 = w * 0.490;
  ctx.beginPath();
  ctx.arc(x2, cy, icon * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = white;
  ctx.fill();
  phone(ctx, x2, cy, icon * 0.90, blue);
  ctx.fillStyle = white;
  ctx.fillText(phoneText, w * 0.535, cy);

  // Services row
  const service = "HVAC SOLAR MEP SOLUTIONS";
  const sfs = fitText(ctx, service, w * 0.86, Math.max(14, bottomH * 0.40), 800);
  ctx.font = `800 ${sfs}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(service, w / 2, y + topH + bottomH * 0.53);
  ctx.textAlign = "left";

  ctx.restore();
}

function footerHeight(w, h, scale) {
  if (h > w * 1.1) return Math.max(120, Math.round(h * .125 * scale));
  return Math.max(88, Math.round(h * .105 * scale));
}
function drawFooter(ctx, w, h, fh) { return h > w * 1.1 ? drawFooterPortrait(ctx, w, h, fh) : drawFooterLandscape(ctx, w, h, fh); }

function drawLogoFallback(ctx, x, y, w, h) {
  ctx.save(); ctx.fillStyle="#005696"; ctx.font=`900 ${Math.round(h*.52)}px Arial, Helvetica, sans-serif`; ctx.textBaseline="top"; ctx.fillText("iCOOL", x, y); ctx.font=`700 ${Math.round(h*.16)}px Arial, Helvetica, sans-serif`; ctx.fillText("COOL YOUR LIFE", x, y+h*.58); ctx.restore();
}

async function getSlogan(file, settings) {
  if (settings.customSlogan?.trim()) return settings.customSlogan.trim();
  const fallback = pickFallbackSlogan(settings.industry);
  try {
    const { image, url } = await loadImageFromFile(file);
    const max = 520, sc = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(image.naturalWidth * sc); c.height = Math.round(image.naturalHeight * sc);
    const cx = c.getContext("2d", { alpha: false }); cx.drawImage(image, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    const res = await fetch("/api/slogan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: c.toDataURL("image/jpeg", .68), industry: settings.industry }) });
    if (!res.ok) return fallback; const data = await res.json(); return data?.slogan || fallback;
  } catch { return fallback; }
}

async function makeImage({ file, settings, logoImage, setStage }) {
  const { image, url } = await loadImageFromFile(file);
  try {
    setStage("Preparing image...");
    const nw = image.naturalWidth || image.width, nh = image.naturalHeight || image.height;
    const maxSide = Number(settings.outputSize || 2200);
    const sc = Math.min(1, maxSide / Math.max(nw, nh));
    const w = Math.round(nw * sc), h = Math.round(nh * sc);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d", { alpha: false }); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h); ctx.drawImage(image,0,0,w,h);
    setStage("Enhancing photo..."); const p = enhance(ctx, w, h, settings.enhancement || "premium"); reduceSpeckles(ctx, w, h, settings.cleanup || "strong"); unsharp(ctx, w, h, p.sharp, p.blur);
    setStage("Creating slogan..."); const slogan = settings.showSlogan === "no" ? "" : await getSlogan(file, settings);
    const fh = footerHeight(w, h, Number(settings.footerScale)/100);
    const margin = Math.round(w*.035);
    const portrait = h > w * 1.1;
    const logoW = Math.round((portrait ? w*.25 : w*.25) * (Number(settings.logoScale)/100));
    const logoRatio = logoImage ? logoImage.naturalHeight / logoImage.naturalWidth : .35;
    const logoH = Math.round(logoW * logoRatio);
    const fontSize = Math.max(22, Math.round(w * (portrait ? .038 : .030)));
    ctx.font = `800 italic ${fontSize}px Arial, Helvetica, sans-serif`;
    let sloganLines = slogan ? wrap(ctx, slogan, w - margin*2, 2) : [];
    const lineH = Math.round(fontSize * 1.25);
    const sloganH = sloganLines.length ? sloganLines.length * lineH : 0;
    const gap = Math.round(h*.018);
    const logoX = margin;
    const logoY = Math.max(20, h - fh - logoH - sloganH - gap*2);
    if (logoImage) ctx.drawImage(logoImage, logoX, logoY, logoW, logoH); else drawLogoFallback(ctx, logoX, logoY, logoW, logoH);
    if (sloganLines.length) {
      ctx.save(); ctx.font = `800 italic ${fontSize}px Arial, Helvetica, sans-serif`; ctx.textBaseline="alphabetic"; ctx.shadowColor="rgba(255,255,255,.85)"; ctx.shadowBlur=7; ctx.lineWidth=Math.max(2, fontSize*.08); ctx.strokeStyle="rgba(255,255,255,.70)"; ctx.fillStyle="#12385d";
      const sx = margin; const sy = logoY + logoH + gap + fontSize;
      for (let i=0;i<sloganLines.length;i++){ const y = sy + i*lineH; ctx.strokeText(sloganLines[i], sx, y); ctx.fillText(sloganLines[i], sx, y); }
      ctx.restore();
    }
    setStage("Adding professional footer..."); drawFooter(ctx, w, h, fh);
    setStage("Exporting..."); return c.toDataURL("image/jpeg", .93);
  } finally { URL.revokeObjectURL(url); }
}

export default function Page() {
  const [settings, setSettings] = useState(defaultSettings);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState("");
  const [stage, setStage] = useState("");
  const [working, setWorking] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const logoRef = useRef(null);

  useEffect(() => { try { const s = localStorage.getItem("icoolV11Settings"); if (s) setSettings({ ...defaultSettings, ...JSON.parse(s) }); } catch {} }, []);
  useEffect(() => { loadImageFromUrl("/icool-logo.png").then(img => { logoRef.current = img; }); }, []);
  const canGenerate = useMemo(() => !!file && !working, [file, working]);

  function update(k, v) { setSettings(prev => { const next = { ...prev, [k]: v }; try { localStorage.setItem("icoolV11Settings", JSON.stringify(next)); } catch {} return next; }); }
  function selectFile(e) { const f = e.target.files?.[0]; setResult(""); if (preview) URL.revokeObjectURL(preview); if (!f) { setFile(null); setPreview(""); return; } setFile(f); setPreview(URL.createObjectURL(f)); }
  async function generate() { if (!file) return; setWorking(true); setStage("Starting..."); setResult(""); try { const dataUrl = await makeImage({ file, settings, logoImage: logoRef.current, setStage }); setResult(dataUrl); setStage(""); } catch (e) { alert("Generation failed: " + e.message); setStage(""); } finally { setWorking(false); } }
  async function share() { if (!result) return; const blob = await fetch(result).then(r => r.blob()); const sf = new File([blob], "icool-branded-photo.jpg", { type: "image/jpeg" }); if (navigator.canShare?.({ files: [sf] })) await navigator.share({ files: [sf], title: "iCOOL Branded Photo" }); else window.open(result, "_blank"); }

  return <main>
    <header className="hero"><div><img className="brandLogo" src="/icool-logo.png" alt="iCOOL"/><h1>iCOOL Photo Branding App</h1><p>Professional real-photo enhancement, transparent logo, clean footer and smart slogan. No generate/generator API.</p></div><div className="versionCard"><b>{VERSION}</b><span>Real transparent logo fixed. Portrait footer no longer overlaps.</span></div></header>
    <section className="grid"><div className="card controls"><label>Upload photo</label><input type="file" accept="image/*" onChange={selectFile}/>{file && <div className="fileInfo">Selected: {file.name}<br/>Size: {mb(file.size)}</div>}<button type="button" disabled={!canGenerate} onClick={generate}>{working ? (stage || "Processing...") : "Generate Branded Photo"}</button><button type="button" className="secondaryBtn" onClick={() => setShowSettings(v=>!v)}>{showSettings ? "Hide Settings" : "Open Settings"}</button>{showSettings && <div className="settingsBox"><label>Project type</label><select value={settings.industry} onChange={e=>update("industry", e.target.value)}><option value="auto">Auto / General</option><option value="hvac">HVAC</option><option value="solar">Solar</option><option value="mep">MEP / Electrical</option><option value="lighting">Lighting</option><option value="inventory">Inventory / Stock</option><option value="team">Team / People</option></select><label>Enhancement strength</label><select value={settings.enhancement} onChange={e=>update("enhancement", e.target.value)}><option value="natural">Natural</option><option value="pro">Pro</option><option value="premium">Premium - recommended</option></select><label>Cleanup strength</label><select value={settings.cleanup} onChange={e=>update("cleanup", e.target.value)}><option value="light">Light</option><option value="medium">Medium</option><option value="strong">Strong - tiny dirt cleanup</option></select><label>Output size</label><select value={settings.outputSize} onChange={e=>update("outputSize", e.target.value)}><option value="1600">Fast</option><option value="2200">Professional</option><option value="2600">High quality</option></select><label>Logo scale</label><select value={settings.logoScale} onChange={e=>update("logoScale", e.target.value)}><option value="85">Small</option><option value="100">Normal</option><option value="115">Large</option></select><label>Footer scale</label><select value={settings.footerScale} onChange={e=>update("footerScale", e.target.value)}><option value="90">Slim</option><option value="100">Normal</option><option value="115">Large</option></select><label>Show slogan</label><select value={settings.showSlogan} onChange={e=>update("showSlogan", e.target.value)}><option value="yes">Yes</option><option value="no">No, logo only</option></select><label>Optional slogan override</label><input type="text" placeholder="Leave empty for smart slogan" value={settings.customSlogan} onChange={e=>update("customSlogan", e.target.value)}/><button type="button" className="secondaryBtn" onClick={()=>{setSettings(defaultSettings); localStorage.removeItem("icoolV11Settings")}}>Reset Settings</button></div>}</div><div className="card previewCard"><div className="previewBox">{result ? <img src={result} alt="Final branded result"/> : preview ? <img src={preview} alt="Original preview"/> : <div className="placeholder">Choose a project photo to start.</div>}</div>{result && <div className="actions"><a href={result} download="icool-branded-photo.jpg">Download</a><button type="button" onClick={share}>Share</button></div>}</div></section>
  </main>;
}
