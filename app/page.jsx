"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const defaultSettings = {
  industry: "auto",
  cleanup: "medium",
  enhancement: "pro",
  logoScale: "100",
  footerScale: "100",
  customSlogan: "",
  outputSize: "1800",
};

const FALLBACK_SLOGANS = {
  hvac: [
    "Engineered Ventilation, Built to Perform.",
    "Professional HVAC Solutions, Built to Last.",
    "Comfort Delivered with Precision."
  ],
  solar: [
    "Clean Energy, Built for Tomorrow.",
    "Harvesting the Sun, Powering Everyday Comfort.",
    "Smart Power for Modern Living."
  ],
  mep: [
    "Reliable Systems, Professional Execution.",
    "Power, Control, and Performance.",
    "Engineering Details That Last."
  ],
  lighting: [
    "Beautiful Pathways, Professionally Illuminated.",
    "Lighting the Way with Elegance and Care."
  ],
  inventory: [
    "Quality Units, Ready to Deliver.",
    "Stocked for Every Cooling Solution."
  ],
  team: [
    "People Behind Smart Energy.",
    "Learning Today, Leading Tomorrow."
  ],
  auto: [
    "Quality Work, Delivered with Confidence.",
    "Professional Solutions for Real Projects.",
    "Clean Execution, Reliable Performance."
  ]
};

function pickFallbackSlogan(industry) {
  const list = FALLBACK_SLOGANS[industry] || FALLBACK_SLOGANS.auto;
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(v, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = reject;
    img.src = url;
  });
}

function loadImageFromUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapCanvasText(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || "").trim().split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function getEnhanceProfile(mode) {
  if (mode === "premium") {
    return {
      lowClip: 0.006,
      highClip: 0.994,
      exposure: 1.035,
      contrast: 1.17,
      saturation: 1.14,
      vibrance: 0.24,
      shadows: 14,
      highlights: -8,
      warmth: 2,
      sharpness: 0.58,
      blur: 1.25
    };
  }

  if (mode === "natural") {
    return {
      lowClip: 0.008,
      highClip: 0.992,
      exposure: 1.018,
      contrast: 1.08,
      saturation: 1.06,
      vibrance: 0.12,
      shadows: 7,
      highlights: -4,
      warmth: 1,
      sharpness: 0.30,
      blur: 1.05
    };
  }

  // pro
  return {
    lowClip: 0.006,
    highClip: 0.994,
    exposure: 1.028,
    contrast: 1.13,
    saturation: 1.10,
    vibrance: 0.18,
    shadows: 10,
    highlights: -6,
    warmth: 1.5,
    sharpness: 0.45,
    blur: 1.15
  };
}

function findLumPercentiles(data, lowClip, highClip) {
  const hist = new Uint32Array(256);
  const total = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    hist[lum]++;
  }

  const lowTarget = total * lowClip;
  const highTarget = total * highClip;

  let acc = 0;
  let low = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= lowTarget) {
      low = i;
      break;
    }
  }

  acc = 0;
  let high = 255;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= highTarget) {
      high = i;
      break;
    }
  }

  if (high - low < 80) {
    low = Math.max(0, low - 10);
    high = Math.min(255, high + 10);
  }

  return { low, high };
}

function applyColorEnhancement(ctx, width, height, mode) {
  const profile = getEnhanceProfile(mode);
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const { low, high } = findLumPercentiles(data, profile.lowClip, profile.highClip);
  const range = Math.max(1, high - low);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Gentle auto-level by luminance range
    r = ((r - low) * 255) / range;
    g = ((g - low) * 255) / range;
    b = ((b - low) * 255) / range;

    r *= profile.exposure;
    g *= profile.exposure;
    b *= profile.exposure;

    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Recover highlights and lift shadows, good for site photos
    const shadowMask = Math.max(0, 1 - lum / 150);
    const highlightMask = Math.max(0, (lum - 185) / 70);
    r += profile.shadows * shadowMask + profile.highlights * highlightMask;
    g += profile.shadows * shadowMask + profile.highlights * highlightMask;
    b += profile.shadows * shadowMask + profile.highlights * highlightMask;

    // Contrast around mid-gray
    r = (r - 128) * profile.contrast + 128;
    g = (g - 128) * profile.contrast + 128;
    b = (b - 128) * profile.contrast + 128;

    // Warmth: makes walls and metal look more natural, not fake
    r += profile.warmth;
    b -= profile.warmth * 0.6;

    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Vibrance: boosts weak colors more than already strong colors
    const maxc = Math.max(r, g, b);
    const avg = (r + g + b) / 3;
    const satAmount = maxc === 0 ? 0 : (maxc - avg) / maxc;
    const vib = 1 + profile.vibrance * (1 - satAmount);

    r = lum + (r - lum) * profile.saturation * vib;
    g = lum + (g - lum) * profile.saturation * vib;
    b = lum + (b - lum) * profile.saturation * vib;

    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }

  ctx.putImageData(img, 0, 0);
}

function applyUnsharpMask(ctx, width, height, amount = 0.45, blurRadius = 1.15) {
  if (amount <= 0) return;

  const original = ctx.getImageData(0, 0, width, height);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = width;
  blurCanvas.height = height;
  const bctx = blurCanvas.getContext("2d", { alpha: false });
  bctx.filter = `blur(${blurRadius}px)`;
  bctx.drawImage(ctx.canvas, 0, 0);
  bctx.filter = "none";

  const blurred = bctx.getImageData(0, 0, width, height);
  const od = original.data;
  const bd = blurred.data;

  for (let i = 0; i < od.length; i += 4) {
    od[i] = clamp(od[i] + (od[i] - bd[i]) * amount);
    od[i + 1] = clamp(od[i + 1] + (od[i + 1] - bd[i + 1]) * amount);
    od[i + 2] = clamp(od[i + 2] + (od[i + 2] - bd[i + 2]) * amount);
  }

  ctx.putImageData(original, 0, 0);
}

function drawLocationIcon(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.08, size * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.48);
  ctx.lineTo(x - size * 0.22, y + size * 0.12);
  ctx.lineTo(x + size * 0.22, y + size * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#005696";
  ctx.beginPath();
  ctx.arc(x, y - size * 0.08, size * 0.10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPhoneIcon(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.12);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - size * 0.18, y - size * 0.25);
  ctx.quadraticCurveTo(x - size * 0.38, y, x - size * 0.10, y + size * 0.30);
  ctx.lineTo(x + size * 0.18, y + size * 0.15);
  ctx.stroke();
  ctx.restore();
}

function drawFooter(ctx, width, height, footerHeight) {
  const blue = "#005696";
  const deepBlue = "#003f7d";
  const orange = "#f25b22";
  const white = "#ffffff";

  const y = height - footerHeight;
  const diagonal = width * 0.085;
  const orangeX = width * 0.62;

  ctx.save();

  ctx.fillStyle = deepBlue;
  ctx.fillRect(0, y, width, footerHeight);

  ctx.fillStyle = blue;
  ctx.fillRect(0, y, width * 0.68, footerHeight);

  ctx.beginPath();
  ctx.moveTo(orangeX + diagonal, y);
  ctx.lineTo(width, y);
  ctx.lineTo(width, height);
  ctx.lineTo(orangeX, height);
  ctx.closePath();
  ctx.fillStyle = orange;
  ctx.fill();

  ctx.strokeStyle = white;
  ctx.lineWidth = Math.max(5, width * 0.004);
  ctx.beginPath();
  ctx.moveTo(orangeX + diagonal, y);
  ctx.lineTo(orangeX, height);
  ctx.stroke();

  const fontSize = Math.max(21, footerHeight * 0.22);
  const iconSize = Math.max(24, footerHeight * 0.30);
  const cy = y + footerHeight * 0.52;

  ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = white;
  ctx.textBaseline = "middle";

  const locCircleX = width * 0.065;
  ctx.beginPath();
  ctx.arc(locCircleX, cy, iconSize * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = white;
  ctx.fill();
  drawLocationIcon(ctx, locCircleX, cy, iconSize * 0.95, blue);
  ctx.fillStyle = white;
  ctx.fillText("Lebanon", width * 0.095, cy);

  const phoneCircleX = width * 0.34;
  ctx.beginPath();
  ctx.arc(phoneCircleX, cy, iconSize * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = white;
  ctx.fill();
  drawPhoneIcon(ctx, phoneCircleX, cy, iconSize * 0.95, blue);
  ctx.fillStyle = white;
  ctx.fillText("Mobile: 03 715 512", width * 0.37, cy);

  ctx.font = `800 ${Math.max(20, footerHeight * 0.215)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText("HVAC SOLAR MEP SOLUTIONS", width * 0.965, cy);
  ctx.textAlign = "left";

  ctx.restore();
}

async function getSmartSlogan(file, industry, customSlogan) {
  if (customSlogan?.trim()) return customSlogan.trim();

  try {
    const { img, url } = await loadImageFromFile(file);
    const canvas = document.createElement("canvas");
    const maxSide = 520;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    const previewDataUrl = canvas.toDataURL("image/jpeg", 0.70);

    const res = await fetch("/api/slogan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: previewDataUrl, industry })
    });

    if (!res.ok) return pickFallbackSlogan(industry);
    const data = await res.json();
    return data?.slogan || pickFallbackSlogan(industry);
  } catch {
    return pickFallbackSlogan(industry);
  }
}

async function createBrandedImage({ file, settings, logoImg, setStage }) {
  const { img, url } = await loadImageFromFile(file);

  try {
    setStage("Preparing canvas...");
    const maxSide = Number(settings.outputSize || 1800);
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
    const width = Math.round(naturalW * scale);
    const height = Math.round(naturalH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    setStage("Enhancing photo...");
    applyColorEnhancement(ctx, width, height, settings.enhancement || "pro");
    const profile = getEnhanceProfile(settings.enhancement || "pro");
    applyUnsharpMask(ctx, width, height, profile.sharpness, profile.blur);

    setStage("Creating slogan...");
    const slogan = await getSmartSlogan(file, settings.industry, settings.customSlogan);

    const footerHeight = Math.max(86, Math.round(height * 0.105 * (Number(settings.footerScale) / 100)));
    const margin = Math.round(width * 0.035);
    const logoW = Math.round((width >= height ? width * 0.24 : width * 0.32) * (Number(settings.logoScale) / 100));
    const logoH = Math.round(logoW * (logoImg.naturalHeight / logoImg.naturalWidth));
    const logoY = Math.max(20, height - footerHeight - logoH - Math.round(height * 0.032));

    const plateX = margin * 0.65;
    const plateY = logoY - Math.round(height * 0.012);
    const sloganFontSize = Math.max(23, Math.round(width * (width >= height ? 0.027 : 0.045)));
    ctx.font = `700 italic ${sloganFontSize}px Arial, Helvetica, sans-serif`;
    const sloganMaxWidth = width - margin * 2 - logoW - Math.round(width * 0.035);
    const sloganLines = wrapCanvasText(ctx, slogan, width >= height ? sloganMaxWidth : width - margin * 2, 2);
    const lineHeight = Math.round(sloganFontSize * 1.25);

    let textX = margin + logoW + Math.round(width * 0.035);
    let textY = height - footerHeight - Math.round(height * 0.095);

    if (width < height) {
      textX = margin;
      textY = logoY + logoH + Math.round(height * 0.022);
    }

    const textWidth = Math.max(...sloganLines.map(line => ctx.measureText(line).width), 0);
    const plateW = Math.min(width - plateX * 2, Math.max(logoW + margin, (textX - plateX) + textWidth + margin));
    const plateH = Math.max(
      logoH + Math.round(height * 0.035),
      (textY - plateY) + sloganLines.length * lineHeight + Math.round(height * 0.02)
    );

    ctx.save();
    roundRect(ctx, plateX, plateY, plateW, plateH, Math.round(width * 0.018));
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fill();
    ctx.restore();

    ctx.drawImage(logoImg, margin, logoY, logoW, logoH);

    ctx.save();
    ctx.font = `700 italic ${sloganFontSize}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < sloganLines.length; i++) {
      const y = textY + i * lineHeight;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillText(sloganLines[i], textX + 2, y + 2);
      ctx.fillStyle = "#12385d";
      ctx.fillText(sloganLines[i], textX, y);
    }
    ctx.restore();

    setStage("Adding footer...");
    drawFooter(ctx, width, height, footerHeight);

    setStage("Exporting...");
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Page() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const logoRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("icoolPhotoSettings");
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    loadImageFromUrl("/icool-logo.png").then((img) => {
      logoRef.current = img;
    });
  }, []);

  function updateSetting(key, value) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem("icoolPhotoSettings", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const canGenerate = useMemo(() => !!file && !loading, [file, loading]);

  function onFileChange(e) {
    const selected = e.target.files?.[0];
    setResult("");
    if (preview) URL.revokeObjectURL(preview);

    if (!selected) {
      setFile(null);
      setPreview("");
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function generate() {
    if (!file) return;
    setLoading(true);
    setStage("Starting...");
    setResult("");

    try {
      const logoImg = logoRef.current || await loadImageFromUrl("/icool-logo.png");
      const dataUrl = await createBrandedImage({ file, settings, logoImg, setStage });
      setResult(dataUrl);
      setStage("");
    } catch (err) {
      alert("Generation failed: " + err.message);
      setStage("");
    } finally {
      setLoading(false);
    }
  }

  async function shareImage() {
    if (!result) return;
    const blob = await fetch(result).then((r) => r.blob());
    const shareFile = new File([blob], "icool-branded-photo.jpg", { type: "image/jpeg" });

    if (navigator.canShare?.({ files: [shareFile] })) {
      await navigator.share({ files: [shareFile], title: "iCOOL Photo" });
    } else {
      window.open(result, "_blank");
    }
  }

  return (
    <main>
      <button
        type="button"
        className="settingsFab"
        aria-label="Open settings"
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSettingsOpen(true);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSettingsOpen(true);
        }}
      >
        ⚙️
      </button>

      {settingsOpen && (
        <div className="settingsModal" onPointerUp={(e) => {
          if (e.target === e.currentTarget) setSettingsOpen(false);
        }}>
          <div className="settingsPanel">
            <div className="settingsHeader">
              <h2>Photo Settings</h2>
              <button type="button" className="closeBtn" onClick={() => setSettingsOpen(false)}>×</button>
            </div>

            <label>Project type</label>
            <select value={settings.industry} onChange={(e) => updateSetting("industry", e.target.value)}>
              <option value="auto">Auto detect</option>
              <option value="hvac">HVAC</option>
              <option value="solar">Solar</option>
              <option value="mep">MEP / Electrical</option>
              <option value="lighting">Lighting</option>
              <option value="inventory">Inventory / Stock</option>
              <option value="finishing">Finishing / Plumbing</option>
              <option value="team">Team / People</option>
            </select>

            <label>Enhancement strength</label>
            <select value={settings.enhancement} onChange={(e) => updateSetting("enhancement", e.target.value)}>
              <option value="natural">Natural</option>
              <option value="pro">Pro - recommended</option>
              <option value="premium">Premium - stronger</option>
            </select>

            <label>Cleanup / color style</label>
            <select value={settings.cleanup} onChange={(e) => updateSetting("cleanup", e.target.value)}>
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="strong">Strong</option>
            </select>

            <label>Output size</label>
            <select value={settings.outputSize} onChange={(e) => updateSetting("outputSize", e.target.value)}>
              <option value="1600">Fast / light</option>
              <option value="1800">Recommended</option>
              <option value="2200">High quality</option>
            </select>

            <label>Logo scale</label>
            <select value={settings.logoScale} onChange={(e) => updateSetting("logoScale", e.target.value)}>
              <option value="85">Small</option>
              <option value="100">Normal</option>
              <option value="115">Large</option>
            </select>

            <label>Footer scale</label>
            <select value={settings.footerScale} onChange={(e) => updateSetting("footerScale", e.target.value)}>
              <option value="90">Slim</option>
              <option value="100">Normal</option>
              <option value="115">Large</option>
            </select>

            <label>Optional slogan override</label>
            <input
              type="text"
              placeholder="Leave empty for smart slogan"
              value={settings.customSlogan}
              onChange={(e) => updateSetting("customSlogan", e.target.value)}
            />

            <button
              type="button"
              className="secondaryBtn"
              onClick={() => {
                setSettings(defaultSettings);
                localStorage.removeItem("icoolPhotoSettings");
              }}
            >
              Reset Settings
            </button>
          </div>
        </div>
      )}

      <section className="hero">
        <div>
          <img className="logo" src="/icool-logo.png" alt="iCOOL" />
          <h1>iCOOL Photo Branding App</h1>
          <p>
            Upload a real project photo. The app keeps the real photo, enhances
            sharpness, light, contrast, color, adds the exact logo, footer, and slogan.
          </p>
        </div>

        <div className="card note">
          v8 Photo Enhancer: auto levels, shadow recovery, color correction, vibrance, and real sharpening.
        </div>
      </section>

      <section className="grid">
        <div className="card controlCard">
          <label>Upload photo</label>
          <input type="file" accept="image/*" onChange={onFileChange} />

          <button type="button" disabled={!canGenerate} onClick={generate}>
            {loading ? (stage || "Processing...") : "Generate Branded Photo"}
          </button>

          <button type="button" className="secondaryBtn" onClick={() => setSettingsOpen(true)}>
            Open Settings
          </button>
        </div>

        <div className="card">
          <div className="previewBox">
            {result ? (
              <img src={result} alt="Result" />
            ) : preview ? (
              <img src={preview} alt="Preview" />
            ) : (
              <p>Choose a photo to preview the result here.</p>
            )}
          </div>

          {result && (
            <div className="resultActions">
              <a href={result} download="icool-branded-photo.jpg">Download</a>
              <button type="button" onClick={shareImage}>Share</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
