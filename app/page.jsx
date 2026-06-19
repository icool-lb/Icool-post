"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const VERSION = "v9 Clean Build";

const defaultSettings = {
  industry: "auto",
  enhancement: "pro",
  cleanup: "medium",
  outputSize: "1900",
  logoScale: "100",
  footerScale: "100",
  customSlogan: "",
  showSlogan: "yes",
};

const FALLBACK_SLOGANS = {
  hvac: [
    "Engineered Comfort, Delivered with Precision.",
    "Professional HVAC Solutions, Built to Last.",
    "Comfort in Every Space, Quality in Every Detail."
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

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image. Please try another photo or convert HEIC to JPG."));
    };
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

function bytesToMb(bytes) {
  if (!bytes) return "-";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getEnhanceProfile(mode) {
  if (mode === "premium") {
    return {
      lowClip: 0.006,
      highClip: 0.994,
      exposure: 1.045,
      contrast: 1.18,
      saturation: 1.14,
      vibrance: 0.22,
      shadows: 16,
      highlights: -9,
      warmth: 2.0,
      sharpness: 0.58,
      blur: 1.15
    };
  }

  if (mode === "natural") {
    return {
      lowClip: 0.008,
      highClip: 0.992,
      exposure: 1.015,
      contrast: 1.07,
      saturation: 1.05,
      vibrance: 0.10,
      shadows: 7,
      highlights: -4,
      warmth: 1.0,
      sharpness: 0.30,
      blur: 1.05
    };
  }

  return {
    lowClip: 0.006,
    highClip: 0.994,
    exposure: 1.028,
    contrast: 1.13,
    saturation: 1.10,
    vibrance: 0.17,
    shadows: 11,
    highlights: -6,
    warmth: 1.4,
    sharpness: 0.45,
    blur: 1.12
  };
}

function findLumPercentiles(data, lowClip, highClip) {
  const hist = new Uint32Array(256);
  const total = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    hist[lum]++;
  }

  let acc = 0;
  let low = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= total * lowClip) {
      low = i;
      break;
    }
  }

  acc = 0;
  let high = 255;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= total * highClip) {
      high = i;
      break;
    }
  }

  if (high - low < 70) {
    low = Math.max(0, low - 12);
    high = Math.min(255, high + 12);
  }

  return { low, high };
}

function applyColorEnhancement(ctx, width, height, mode) {
  const profile = getEnhanceProfile(mode);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const { low, high } = findLumPercentiles(data, profile.lowClip, profile.highClip);
  const range = Math.max(1, high - low);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = ((r - low) * 255) / range;
    g = ((g - low) * 255) / range;
    b = ((b - low) * 255) / range;

    r *= profile.exposure;
    g *= profile.exposure;
    b *= profile.exposure;

    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const shadowMask = Math.max(0, 1 - lum / 155);
    const highlightMask = Math.max(0, (lum - 188) / 67);
    r += profile.shadows * shadowMask + profile.highlights * highlightMask;
    g += profile.shadows * shadowMask + profile.highlights * highlightMask;
    b += profile.shadows * shadowMask + profile.highlights * highlightMask;

    r = (r - 128) * profile.contrast + 128;
    g = (g - 128) * profile.contrast + 128;
    b = (b - 128) * profile.contrast + 128;

    r += profile.warmth;
    b -= profile.warmth * 0.55;

    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

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

  ctx.putImageData(imageData, 0, 0);

  return profile;
}

function applyUnsharpMask(ctx, width, height, amount, blurRadius) {
  if (!amount) return;

  let original;
  try {
    original = ctx.getImageData(0, 0, width, height);
  } catch {
    return;
  }

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = width;
  blurCanvas.height = height;
  const bctx = blurCanvas.getContext("2d", { alpha: false });

  try {
    bctx.filter = `blur(${blurRadius}px)`;
  } catch {}

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

function wrapText(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;

    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;

      if (lines.length >= maxLines - 1) break;
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

function drawPin(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.10, size * 0.30, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.45);
  ctx.lineTo(x - size * 0.22, y + size * 0.10);
  ctx.lineTo(x + size * 0.22, y + size * 0.10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#005696";
  ctx.beginPath();
  ctx.arc(x, y - size * 0.10, size * 0.10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPhone(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.12);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - size * 0.18, y - size * 0.25);
  ctx.quadraticCurveTo(x - size * 0.38, y, x - size * 0.08, y + size * 0.30);
  ctx.lineTo(x + size * 0.18, y + size * 0.14);
  ctx.stroke();
  ctx.restore();
}

function drawFooter(ctx, width, height, footerHeight) {
  const blue = "#005696";
  const deepBlue = "#003f7d";
  const orange = "#f25b22";
  const white = "#ffffff";

  const y = height - footerHeight;
  const orangeStart = width * 0.62;
  const diagonal = width * 0.085;

  ctx.save();

  ctx.fillStyle = deepBlue;
  ctx.fillRect(0, y, width, footerHeight);

  ctx.fillStyle = blue;
  ctx.fillRect(0, y, width * 0.68, footerHeight);

  ctx.fillStyle = orange;
  ctx.beginPath();
  ctx.moveTo(orangeStart + diagonal, y);
  ctx.lineTo(width, y);
  ctx.lineTo(width, height);
  ctx.lineTo(orangeStart, height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = white;
  ctx.lineWidth = Math.max(5, width * 0.004);
  ctx.beginPath();
  ctx.moveTo(orangeStart + diagonal, y);
  ctx.lineTo(orangeStart, height);
  ctx.stroke();

  const fontSize = Math.max(20, footerHeight * 0.22);
  const serviceFont = Math.max(19, footerHeight * 0.21);
  const iconSize = Math.max(24, footerHeight * 0.30);
  const cy = y + footerHeight * 0.52;

  ctx.textBaseline = "middle";
  ctx.fillStyle = white;
  ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;

  const x1 = width * 0.065;
  ctx.beginPath();
  ctx.arc(x1, cy, iconSize * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = white;
  ctx.fill();
  drawPin(ctx, x1, cy, iconSize * 0.95, blue);
  ctx.fillStyle = white;
  ctx.fillText("Lebanon", width * 0.095, cy);

  const x2 = width * 0.34;
  ctx.beginPath();
  ctx.arc(x2, cy, iconSize * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = white;
  ctx.fill();
  drawPhone(ctx, x2, cy, iconSize * 0.95, blue);
  ctx.fillStyle = white;
  ctx.fillText("Mobile: 03 715 512", width * 0.37, cy);

  ctx.font = `800 ${serviceFont}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText("HVAC SOLAR MEP SOLUTIONS", width * 0.965, cy);
  ctx.textAlign = "left";

  ctx.restore();
}

function drawLogoFallback(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = "#005696";
  ctx.font = `900 ${Math.round(h * 0.45)}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText("iCOOL", x, y);
  ctx.fillStyle = "#005696";
  ctx.font = `700 ${Math.round(h * 0.16)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("COOL YOUR LIFE", x, y + h * 0.50);
  ctx.restore();
}

async function getSlogan(file, settings) {
  if (settings.customSlogan?.trim()) return settings.customSlogan.trim();

  const fallback = pickFallbackSlogan(settings.industry);

  try {
    const { image, url } = await loadImageFromFile(file);

    const maxSide = 520;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    const smallImage = canvas.toDataURL("image/jpeg", 0.68);

    const response = await fetch("/api/slogan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: smallImage, industry: settings.industry })
    });

    if (!response.ok) return fallback;

    const data = await response.json();
    return data?.slogan || fallback;
  } catch {
    return fallback;
  }
}

async function createBrandedImage({ file, settings, logoImage, setStage }) {
  const { image, url } = await loadImageFromFile(file);

  try {
    setStage("Preparing image...");

    const naturalW = image.naturalWidth || image.width;
    const naturalH = image.naturalHeight || image.height;
    const maxSide = Number(settings.outputSize || 1900);
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
    ctx.drawImage(image, 0, 0, width, height);

    setStage("Enhancing photo...");
    const profile = applyColorEnhancement(ctx, width, height, settings.enhancement || "pro");
    applyUnsharpMask(ctx, width, height, profile.sharpness, profile.blur);

    setStage("Creating slogan...");
    const slogan = settings.showSlogan === "no" ? "" : await getSlogan(file, settings);

    const footerHeight = Math.max(82, Math.round(height * 0.105 * (Number(settings.footerScale) / 100)));
    const margin = Math.round(width * 0.035);

    const baseLogoW = width >= height ? width * 0.24 : width * 0.32;
    const logoW = Math.round(baseLogoW * (Number(settings.logoScale) / 100));
    const logoRatio = logoImage ? (logoImage.naturalHeight / logoImage.naturalWidth) : 0.35;
    const logoH = Math.round(logoW * logoRatio);
    const logoX = margin;
    const logoY = Math.max(20, height - footerHeight - logoH - Math.round(height * 0.030));

    let textX = logoX + logoW + Math.round(width * 0.035);
    let textY = height - footerHeight - Math.round(height * 0.090);
    let maxTextWidth = width - textX - margin;

    const fontSize = Math.max(22, Math.round(width * (width >= height ? 0.027 : 0.043)));
    ctx.font = `700 italic ${fontSize}px Arial, Helvetica, sans-serif`;

    if (width < height) {
      textX = margin;
      textY = logoY + logoH + Math.round(height * 0.023);
      maxTextWidth = width - margin * 2;
    }

    const sloganLines = slogan ? wrapText(ctx, slogan, maxTextWidth, 2) : [];
    const lineHeight = Math.round(fontSize * 1.25);

    const textWidth = sloganLines.length
      ? Math.max(...sloganLines.map((line) => ctx.measureText(line).width))
      : 0;

    const plateX = Math.max(0, margin * 0.55);
    const plateY = Math.max(0, logoY - Math.round(height * 0.012));
    const plateW = Math.min(
      width - plateX * 2,
      Math.max(
        logoW + margin,
        sloganLines.length ? (textX - plateX) + textWidth + margin : logoW + margin
      )
    );
    const plateH = Math.max(
      logoH + Math.round(height * 0.030),
      sloganLines.length
        ? (textY - plateY) + sloganLines.length * lineHeight + Math.round(height * 0.018)
        : logoH + Math.round(height * 0.030)
    );

    ctx.save();
    roundRect(ctx, plateX, plateY, plateW, plateH, Math.round(width * 0.017));
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fill();
    ctx.restore();

    if (logoImage) {
      ctx.drawImage(logoImage, logoX, logoY, logoW, logoH);
    } else {
      drawLogoFallback(ctx, logoX, logoY, logoW, logoH);
    }

    if (sloganLines.length) {
      ctx.save();
      ctx.font = `700 italic ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.textBaseline = "alphabetic";

      for (let i = 0; i < sloganLines.length; i++) {
        const y = textY + i * lineHeight;
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.fillText(sloganLines[i], textX + 2, y + 2);
        ctx.fillStyle = "#12385d";
        ctx.fillText(sloganLines[i], textX, y);
      }

      ctx.restore();
    }

    setStage("Adding footer...");
    drawFooter(ctx, width, height, footerHeight);

    setStage("Exporting...");
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Page() {
  const [settings, setSettings] = useState(defaultSettings);
  const [file, setFile] = useState(null);
  const [originalPreview, setOriginalPreview] = useState("");
  const [result, setResult] = useState("");
  const [stage, setStage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [fileSize, setFileSize] = useState("");
  const logoRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("icoolV9Settings");
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    loadImageFromUrl("/icool-logo.png").then((img) => {
      logoRef.current = img;
    });
  }, []);

  const canGenerate = useMemo(() => !!file && !isWorking, [file, isWorking]);

  function updateSetting(key, value) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem("icoolV9Settings", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function onFileChange(event) {
    const selected = event.target.files?.[0];
    setResult("");

    if (originalPreview) URL.revokeObjectURL(originalPreview);

    if (!selected) {
      setFile(null);
      setOriginalPreview("");
      setFileSize("");
      return;
    }

    setFile(selected);
    setOriginalPreview(URL.createObjectURL(selected));
    setFileSize(bytesToMb(selected.size));
  }

  async function generate() {
    if (!file) return;

    setIsWorking(true);
    setStage("Starting...");
    setResult("");

    try {
      const dataUrl = await createBrandedImage({
        file,
        settings,
        logoImage: logoRef.current,
        setStage
      });

      setResult(dataUrl);
      setStage("");
    } catch (error) {
      alert("Generation failed: " + error.message);
      setStage("");
    } finally {
      setIsWorking(false);
    }
  }

  async function shareResult() {
    if (!result) return;

    const blob = await fetch(result).then((r) => r.blob());
    const shareFile = new File([blob], "icool-branded-photo.jpg", { type: "image/jpeg" });

    if (navigator.canShare?.({ files: [shareFile] })) {
      await navigator.share({
        files: [shareFile],
        title: "iCOOL Branded Photo"
      });
    } else {
      window.open(result, "_blank");
    }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <img className="brandLogo" src="/icool-logo.png" alt="iCOOL" />
          <h1>iCOOL Photo Branding App</h1>
          <p>
            Real photo enhancement, exact iCOOL logo, professional footer,
            and slogan. No server image rendering. No generate/generator API.
          </p>
        </div>

        <div className="versionCard">
          <b>{VERSION}</b>
          <span>Canvas photo enhancer is active.</span>
        </div>
      </header>

      <section className="grid">
        <div className="card controls">
          <label>Upload photo</label>
          <input type="file" accept="image/*" onChange={onFileChange} />

          {file && (
            <div className="fileInfo">
              Selected: {file.name}<br />
              Size: {fileSize}
            </div>
          )}

          <button type="button" onClick={generate} disabled={!canGenerate}>
            {isWorking ? stage || "Processing..." : "Generate Branded Photo"}
          </button>

          <button type="button" className="secondaryBtn" onClick={() => setShowSettings((v) => !v)}>
            {showSettings ? "Hide Settings" : "Open Settings"}
          </button>

          {showSettings && (
            <div className="settingsBox">
              <label>Project type</label>
              <select value={settings.industry} onChange={(e) => updateSetting("industry", e.target.value)}>
                <option value="auto">Auto detect / General</option>
                <option value="hvac">HVAC</option>
                <option value="solar">Solar</option>
                <option value="mep">MEP / Electrical</option>
                <option value="lighting">Lighting</option>
                <option value="inventory">Inventory / Stock</option>
                <option value="team">Team / People</option>
              </select>

              <label>Enhancement strength</label>
              <select value={settings.enhancement} onChange={(e) => updateSetting("enhancement", e.target.value)}>
                <option value="natural">Natural</option>
                <option value="pro">Pro - recommended</option>
                <option value="premium">Premium - stronger</option>
              </select>

              <label>Output size</label>
              <select value={settings.outputSize} onChange={(e) => updateSetting("outputSize", e.target.value)}>
                <option value="1600">Fast / lighter</option>
                <option value="1900">Recommended</option>
                <option value="2300">High quality</option>
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

              <label>Show slogan</label>
              <select value={settings.showSlogan} onChange={(e) => updateSetting("showSlogan", e.target.value)}>
                <option value="yes">Yes</option>
                <option value="no">No, logo only</option>
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
                  localStorage.removeItem("icoolV9Settings");
                }}
              >
                Reset Settings
              </button>
            </div>
          )}
        </div>

        <div className="card previewCard">
          <div className="previewBox">
            {result ? (
              <img src={result} alt="Final branded result" />
            ) : originalPreview ? (
              <img src={originalPreview} alt="Original preview" />
            ) : (
              <div className="placeholder">Choose a project photo to start.</div>
            )}
          </div>

          {result && (
            <div className="actions">
              <a href={result} download="icool-branded-photo.jpg">Download</a>
              <button type="button" onClick={shareResult}>Share</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
