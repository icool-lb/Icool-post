"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const VERSION = "v14 Pro Custom Logo + Footer Colors";

const FRAME_PRESETS = {
  portrait: { label: "Portrait 4:5", w: 1080, h: 1350 },
  landscape: { label: "Landscape 16:9", w: 1600, h: 900 },
  square: { label: "Square 1:1", w: 1200, h: 1200 },
  story: { label: "Story 9:16", w: 1080, h: 1920 },
};

const defaultSettings = {
  industry: "auto",
  frame: "portrait",
  enhancement: "pro",
  cleanup: "strong",
  aiCleanup: "off",
  outputQuality: "pro",
  logoScale: "100",
  footerScale: "100",
  logoPlate: "foggy",
  logoOffsetX: "0",
  logoOffsetY: "0",
  customLogoDataUrl: "",
  customLogoName: "",
  showSlogan: "yes",
  customSlogan: "",
  sloganOffsetX: "0",
  sloganOffsetY: "0",
  sloganFontScale: "100",
  sloganFontFamily: "Arial, Helvetica, sans-serif",
  sloganPlate: "foggy",
  locationText: "Lebanon",
  phoneText: "Mobile: 03 715 512",
  servicesText: "HVAC SOLAR MEP SOLUTIONS",
  footerBlueColor: "#005696",
  footerDeepBlueColor: "#003f7d",
  footerOrangeColor: "#f25b22",
  footerTextColor: "#ffffff",
};

const FALLBACK_SLOGANS = {
  hvac: [
    "Precision Installation, Built to Last.",
    "Comfort in Every Space, Quality in Every Detail.",
    "Professional HVAC Solutions, Built to Last.",
  ],
  solar: [
    "Clean Energy, Built for Tomorrow.",
    "Harvesting the Sun, Powering Everyday Comfort.",
    "Smart Power for Modern Living.",
  ],
  mep: [
    "Reliable Systems, Professional Execution.",
    "Power, Control, and Performance.",
    "Engineering Details That Last.",
  ],
  construction: [
    "Building Excellence, Detail by Detail.",
    "Professional Execution from Ground to Finish.",
    "Quality Construction, Built with Confidence.",
  ],
  lighting: [
    "Beautiful Pathways, Professionally Illuminated.",
    "Lighting the Way with Elegance and Care.",
  ],
  inventory: ["Quality Units, Ready to Deliver.", "Stocked for Every Cooling Solution."],
  team: ["People Behind Smart Energy.", "Learning Today, Leading Tomorrow."],
  auto: [
    "Quality Work, Delivered with Confidence.",
    "Professional Solutions for Real Projects.",
    "Clean Execution, Reliable Performance.",
  ],
};

function pickFallbackSlogan(industry) {
  const list = FALLBACK_SLOGANS[industry] || FALLBACK_SLOGANS.auto;
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(v, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}

function mb(bytes) {
  if (!bytes) return "-";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image. Please use JPG/PNG or convert HEIC to JPG."));
    };
    image.src = url;
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
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

function getFrame(settings) {
  return FRAME_PRESETS[settings.frame] || FRAME_PRESETS.portrait;
}

function outputDimensions(settings) {
  const base = getFrame(settings);
  if (settings.outputQuality === "light") {
    return { w: Math.round(base.w * 0.82), h: Math.round(base.h * 0.82) };
  }
  if (settings.outputQuality === "high") {
    return { w: Math.round(base.w * 1.18), h: Math.round(base.h * 1.18) };
  }
  return { w: base.w, h: base.h };
}

function getEnhanceProfile(mode) {
  if (mode === "premium") {
    return {
      lowClip: 0.004,
      highClip: 0.996,
      exposure: 1.052,
      contrast: 1.22,
      saturation: 1.12,
      vibrance: 0.3,
      shadows: 19,
      highlights: -13,
      warmth: 1.4,
      sharpness: 0.78,
      blur: 1.55,
    };
  }

  if (mode === "natural") {
    return {
      lowClip: 0.008,
      highClip: 0.992,
      exposure: 1.018,
      contrast: 1.08,
      saturation: 1.05,
      vibrance: 0.12,
      shadows: 8,
      highlights: -5,
      warmth: 0.8,
      sharpness: 0.36,
      blur: 1.05,
    };
  }

  return {
    lowClip: 0.005,
    highClip: 0.995,
    exposure: 1.035,
    contrast: 1.16,
    saturation: 1.09,
    vibrance: 0.22,
    shadows: 14,
    highlights: -9,
    warmth: 1.0,
    sharpness: 0.58,
    blur: 1.25,
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

function applyColorEnhancement(ctx, w, h, mode) {
  const profile = getEnhanceProfile(mode);
  const imageData = ctx.getImageData(0, 0, w, h);
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

function applyUnsharpMask(ctx, w, h, amount, blurRadius) {
  if (!amount) return;
  const original = ctx.getImageData(0, 0, w, h);
  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bctx = blurCanvas.getContext("2d", { alpha: false });

  try {
    bctx.filter = `blur(${blurRadius}px)`;
  } catch {}

  bctx.drawImage(ctx.canvas, 0, 0);
  bctx.filter = "none";

  const blurred = bctx.getImageData(0, 0, w, h);
  const od = original.data;
  const bd = blurred.data;

  for (let i = 0; i < od.length; i += 4) {
    od[i] = clamp(od[i] + (od[i] - bd[i]) * amount);
    od[i + 1] = clamp(od[i + 1] + (od[i + 1] - bd[i + 1]) * amount);
    od[i + 2] = clamp(od[i + 2] + (od[i + 2] - bd[i + 2]) * amount);
  }

  ctx.putImageData(original, 0, 0);
}

function median3(vals) {
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}

function applyLocalCleanup(ctx, w, h, strength) {
  if (strength === "off") return;
  const amount = strength === "strong" ? 1 : strength === "medium" ? 0.65 : 0.35;

  const source = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(source);
  out.data.set(source.data);

  const data = source.data;
  const dst = out.data;
  const startY = Math.floor(h * 0.42);

  for (let y = startY; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const sat = maxc - minc;

      const isBrightTrashColor =
        sat > 45 &&
        lum > 45 &&
        ((r > g * 1.22 && r > b * 1.22) ||
          (b > r * 1.18 && b > g * 1.12) ||
          (g > r * 1.18 && g > b * 1.12));

      if (isBrightTrashColor) {
        const rs = [], gs = [], bs = [];
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const ni = ((y + dy) * w + (x + dx)) * 4;
            rs.push(data[ni]);
            gs.push(data[ni + 1]);
            bs.push(data[ni + 2]);
          }
        }
        dst[i] = clamp(r * (1 - amount) + median3(rs) * amount);
        dst[i + 1] = clamp(g * (1 - amount) + median3(gs) * amount);
        dst[i + 2] = clamp(b * (1 - amount) + median3(bs) * amount);
      }
    }
  }

  ctx.putImageData(out, 0, 0);
}

function drawCropFrame(image, settings, transform) {
  const { w, h } = outputDimensions(settings);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d", { alpha: false });
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";

  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, w, h);

  const base = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const zoom = Math.max(1, transform.zoom || 1);
  const scale = base * zoom;
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const dx = (w - drawW) / 2 + (transform.x || 0) * w;
  const dy = (h - drawH) / 2 + (transform.y || 0) * h;

  c.drawImage(image, dx, dy, drawW, drawH);
  return { canvas, ctx: c, w, h };
}

function fitText(ctx, text, maxWidth, startSize, weight = 700, family = "Arial, Helvetica, sans-serif", italic = false) {
  let size = startSize;
  while (size > 10) {
    ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  return size;
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

function pin(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.1, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.45);
  ctx.lineTo(x - size * 0.22, y + size * 0.1);
  ctx.lineTo(x + size * 0.22, y + size * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.1, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function phone(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.12);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - size * 0.18, y - size * 0.25);
  ctx.quadraticCurveTo(x - size * 0.38, y, x - size * 0.08, y + size * 0.3);
  ctx.lineTo(x + size * 0.18, y + size * 0.14);
  ctx.stroke();
  ctx.restore();
}

function footerHeight(w, h, settings) {
  const portraitish = h > w;
  const base = portraitish ? h * 0.112 : h * 0.115;
  return Math.max(portraitish ? 115 : 82, Math.round(base * (Number(settings.footerScale) / 100)));
}

function drawFooter(ctx, w, h, fh, settings) {
  if (h > w) drawFooterPortrait(ctx, w, h, fh, settings);
  else drawFooterLandscape(ctx, w, h, fh, settings);
}

function drawFooterLandscape(ctx, w, h, fh, settings) {
  const blue = settings.footerBlueColor || "#005696";
  const deep = settings.footerDeepBlueColor || "#003f7d";
  const orange = settings.footerOrangeColor || "#f25b22";
  const white = settings.footerTextColor || "#ffffff";
  const y = h - fh;
  const orangeStart = w * 0.63;
  const diagonal = w * 0.07;

  ctx.save();
  ctx.fillStyle = deep;
  ctx.fillRect(0, y, w, fh);
  ctx.fillStyle = blue;
  ctx.fillRect(0, y, w * 0.68, fh);

  ctx.fillStyle = orange;
  ctx.beginPath();
  ctx.moveTo(orangeStart + diagonal, y);
  ctx.lineTo(w, y);
  ctx.lineTo(w, h);
  ctx.lineTo(orangeStart, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = white;
  ctx.lineWidth = Math.max(5, w * 0.004);
  ctx.beginPath();
  ctx.moveTo(orangeStart + diagonal, y);
  ctx.lineTo(orangeStart, h);
  ctx.stroke();

  const cy = y + fh * 0.52;
  const icon = Math.max(26, fh * 0.33);
  const fs = Math.max(22, fh * 0.23);

  ctx.textBaseline = "middle";
  ctx.fillStyle = white;
  ctx.font = `700 ${fs}px Arial, Helvetica, sans-serif`;

  const x1 = w * 0.062;
  ctx.beginPath();
  ctx.arc(x1, cy, icon * 0.56, 0, Math.PI * 2);
  ctx.fillStyle = white;
  ctx.fill();
  pin(ctx, x1, cy, icon * 0.95, blue);
  ctx.fillStyle = white;
  ctx.font = `700 ${fitText(ctx, settings.locationText || "Lebanon", w * 0.16, fs, 700)}px Arial, Helvetica, sans-serif`;
  ctx.fillText(settings.locationText || "Lebanon", w * 0.095, cy);

  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = white;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.29, y + fh * 0.23);
  ctx.lineTo(w * 0.29, y + fh * 0.77);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const phoneText = settings.phoneText || "Mobile: 03 715 512";
  const phoneCircleX = w * 0.36;
  const phoneTextX = w * 0.39;
  ctx.beginPath();
  ctx.arc(phoneCircleX, cy, icon * 0.56, 0, Math.PI * 2);
  ctx.fillStyle = white;
  ctx.fill();
  phone(ctx, phoneCircleX, cy, icon * 0.95, blue);
  ctx.fillStyle = white;
  ctx.font = `700 ${fitText(ctx, phoneText, w * 0.22, fs, 700)}px Arial, Helvetica, sans-serif`;
  ctx.fillText(phoneText, phoneTextX, cy);

  const service = settings.servicesText || "HVAC SOLAR MEP SOLUTIONS";
  const sfs = fitText(ctx, service, w * 0.31, Math.max(22, fh * 0.23), 800);
  ctx.font = `800 ${sfs}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(service, w * 0.965, cy);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawFooterPortrait(ctx, w, h, fh, settings) {
  const blue = settings.footerBlueColor || "#005696";
  const orange = settings.footerOrangeColor || "#f25b22";
  const white = settings.footerTextColor || "#ffffff";
  const y = h - fh;
  const topH = fh * 0.62;
  const bottomH = fh - topH;

  ctx.save();
  ctx.fillStyle = blue;
  ctx.fillRect(0, y, w, topH);
  ctx.fillStyle = orange;
  ctx.fillRect(0, y + topH, w, bottomH);

  const cy = y + topH * 0.52;
  const icon = Math.max(18, Math.min(32, topH * 0.31));
  ctx.textBaseline = "middle";
  ctx.fillStyle = white;

  const loc = settings.locationText || "Lebanon";
  const locSize = fitText(ctx, loc, w * 0.21, Math.max(14, topH * 0.25), 700);
  ctx.font = `700 ${locSize}px Arial, Helvetica, sans-serif`;
  const x1 = w * 0.075;
  ctx.beginPath();
  ctx.arc(x1, cy, icon * 0.53, 0, Math.PI * 2);
  ctx.fillStyle = white;
  ctx.fill();
  pin(ctx, x1, cy, icon * 0.92, blue);
  ctx.fillStyle = white;
  ctx.fillText(loc, w * 0.12, cy);

  const ptext = settings.phoneText || "Mobile: 03 715 512";
  const psize = fitText(ctx, ptext, w * 0.33, Math.max(13, topH * 0.235), 700);
  ctx.font = `700 ${psize}px Arial, Helvetica, sans-serif`;
  const x2 = w * 0.48;
  ctx.beginPath();
  ctx.arc(x2, cy, icon * 0.53, 0, Math.PI * 2);
  ctx.fillStyle = white;
  ctx.fill();
  phone(ctx, x2, cy, icon * 0.92, blue);
  ctx.fillStyle = white;
  ctx.fillText(ptext, w * 0.525, cy);

  const service = settings.servicesText || "HVAC SOLAR MEP SOLUTIONS";
  const sfs = fitText(ctx, service, w * 0.86, Math.max(14, bottomH * 0.4), 800);
  ctx.font = `800 ${sfs}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(service, w / 2, y + topH + bottomH * 0.53);
  ctx.textAlign = "left";
  ctx.restore();
}

function logoPlacement(w, h, settings, fh, logo) {
  const portraitish = h > w;
  const logoW = Math.round((portraitish ? w * 0.235 : w * 0.225) * (Number(settings.logoScale) / 100));
  const ratio = logo ? logo.naturalHeight / logo.naturalWidth : 0.42;
  const logoH = Math.round(logoW * ratio);
  const margin = Math.round(w * (portraitish ? 0.04 : 0.045));
  const defaultX = margin;
  const defaultY = Math.max(20, h - fh - Math.round(h * (portraitish ? 0.145 : 0.15)));
  const x = defaultX + (Number(settings.logoOffsetX) / 100) * w;
  const y = defaultY + (Number(settings.logoOffsetY) / 100) * h;
  return { logoX: x, logoY: y, logoW, logoH };
}

function drawLogoFog(ctx, logo, x, y, w, h, mode) {
  if (!logo || mode === "none") return;
  const alpha = mode === "strong" ? 0.55 : 0.32;
  const blurAmount = mode === "strong" ? Math.max(18, w * 0.08) : Math.max(12, w * 0.06);

  const fog = document.createElement("canvas");
  fog.width = Math.ceil(w + blurAmount * 2.8);
  fog.height = Math.ceil(h + blurAmount * 2.8);
  const fctx = fog.getContext("2d");
  const dx = (fog.width - w) / 2;
  const dy = (fog.height - h) / 2;

  fctx.save();
  try {
    fctx.filter = `blur(${blurAmount}px)`;
  } catch {}
  fctx.globalAlpha = alpha;
  fctx.drawImage(logo, dx, dy, w, h);
  fctx.globalCompositeOperation = "source-in";
  fctx.fillStyle = "rgba(255,255,255,0.95)";
  fctx.fillRect(0, 0, fog.width, fog.height);
  fctx.restore();

  ctx.drawImage(fog, x - dx, y - dy);
}

function drawTextFog(ctx, lines, x, y, lineH, fontSize, family, mode) {
  if (!lines?.length || mode === "none") return;
  const alpha = mode === "strong" ? 0.46 : 0.25;
  const blurAmount = mode === "strong" ? Math.max(10, fontSize * 0.55) : Math.max(8, fontSize * 0.42);

  const temp = document.createElement("canvas");
  temp.width = ctx.canvas.width;
  temp.height = ctx.canvas.height;
  const t = temp.getContext("2d");

  t.save();
  try {
    t.filter = `blur(${blurAmount}px)`;
  } catch {}
  t.globalAlpha = alpha;
  t.textBaseline = "alphabetic";
  t.font = `italic 800 ${fontSize}px ${family}`;
  t.fillStyle = "rgba(255,255,255,0.96)";
  lines.forEach((line, index) => t.fillText(line, x, y + index * lineH));
  t.restore();

  ctx.drawImage(temp, 0, 0);
}

function drawLogoAndSlogan(ctx, w, h, logo, settings, slogan, fh) {
  const { logoX, logoY, logoW, logoH } = logoPlacement(w, h, settings, fh, logo);

  drawLogoFog(ctx, logo, logoX, logoY, logoW, logoH, settings.logoPlate);

  if (logo) {
    ctx.drawImage(logo, logoX, logoY, logoW, logoH);
  } else {
    ctx.save();
    ctx.fillStyle = settings.footerBlueColor || "#005696";
    ctx.font = `900 ${Math.round(logoH * 0.45)}px Arial, Helvetica, sans-serif`;
    ctx.fillText("iCOOL", logoX, logoY + logoH * 0.5);
    ctx.restore();
  }

  if (!slogan || settings.showSlogan === "no") return;

  const portraitish = h > w;
  const margin = Math.round(w * (portraitish ? 0.04 : 0.045));
  const baseFont = Math.max(24, Math.round(w * (portraitish ? 0.036 : 0.031)));
  const fontSize = Math.round(baseFont * (Number(settings.sloganFontScale) / 100));
  const family = settings.sloganFontFamily || "Arial, Helvetica, sans-serif";

  let textX = portraitish ? margin : logoX + logoW + Math.round(w * 0.03);
  let textY = portraitish ? logoY + logoH + Math.round(h * 0.03) : h - fh - Math.round(h * 0.055);
  textX += (Number(settings.sloganOffsetX) / 100) * w;
  textY += (Number(settings.sloganOffsetY) / 100) * h;

  let maxWidth = portraitish ? w - margin * 2 : w - textX - margin;
  maxWidth = Math.max(maxWidth, w * 0.25);

  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.font = `italic 800 ${fontSize}px ${family}`;
  const lines = wrapText(ctx, slogan, maxWidth, 2);
  const lineH = Math.round(fontSize * 1.22);

  drawTextFog(ctx, lines, textX, textY, lineH, fontSize, family, settings.sloganPlate);

  for (let i = 0; i < lines.length; i++) {
    const y = textY + i * lineH;
    ctx.shadowColor = "rgba(255,255,255,0.55)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#12385d";
    ctx.fillText(lines[i], textX, y);
  }
  ctx.restore();
}

async function getSlogan(file, settings) {
  if (settings.customSlogan?.trim()) return settings.customSlogan.trim();
  return pickFallbackSlogan(settings.industry);
}

async function applyOptionalAiCleanup(canvas, settings, setStage) {
  if (settings.aiCleanup !== "on") return canvas;
  setStage("AI cleanup is optional and needs server setup. Using local professional cleanup...");
  return canvas;
}

async function createFinalImage({ file, settings, transform, logo, setStage }) {
  const { image, url } = await loadImageFromFile(file);
  try {
    setStage("Cropping frame...");
    let { canvas, ctx, w, h } = drawCropFrame(image, settings, transform);

    setStage("Enhancing image...");
    const profile = applyColorEnhancement(ctx, w, h, settings.enhancement);
    applyUnsharpMask(ctx, w, h, profile.sharpness, profile.blur);

    setStage("Cleaning small mess...");
    applyLocalCleanup(ctx, w, h, settings.cleanup);

    canvas = await applyOptionalAiCleanup(canvas, settings, setStage);
    ctx = canvas.getContext("2d", { alpha: false });
    w = canvas.width;
    h = canvas.height;

    setStage("Professional finishing...");
    const finalProfile = getEnhanceProfile(settings.enhancement);
    applyUnsharpMask(ctx, w, h, finalProfile.sharpness * 0.35, finalProfile.blur);

    const fh = footerHeight(w, h, settings);
    setStage("Creating slogan...");
    const slogan = await getSlogan(file, settings);

    setStage("Adding branding...");
    drawLogoAndSlogan(ctx, w, h, logo, settings, slogan, fh);

    setStage("Adding footer...");
    drawFooter(ctx, w, h, fh, settings);

    setStage("Exporting...");
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function previewOverlayStyle(settings) {
  return {
    logo: {
      left: `${8 + Number(settings.logoOffsetX)}%`,
      bottom: `${18 - Number(settings.logoOffsetY)}%`,
    },
    slogan: {
      left: `${28 + Number(settings.sloganOffsetX)}%`,
      bottom: `${20 - Number(settings.sloganOffsetY)}%`,
      fontFamily: settings.sloganFontFamily,
      fontSize: `${Math.max(12, 12 * (Number(settings.sloganFontScale) / 100))}px`,
    },
  };
}

export default function Page() {
  const [settings, setSettings] = useState(defaultSettings);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState("");
  const [stage, setStage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [fileSize, setFileSize] = useState("");
  const [transform, setTransform] = useState({ zoom: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const logoRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("icoolV14Settings") || localStorage.getItem("icoolV13Settings");
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    const source = settings.customLogoDataUrl || "/icool-logo.png";
    loadImageFromUrl(source).then((img) => {
      logoRef.current = img;
    });
  }, [settings.customLogoDataUrl]);

  function updateSetting(key, value) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem("icoolV14Settings", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function onFileChange(event) {
    const selected = event.target.files?.[0];
    setResult("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!selected) {
      setFile(null);
      setPreviewUrl("");
      setFileSize("");
      return;
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setFileSize(mb(selected.size));
    setTransform({ zoom: 1, x: 0, y: 0 });
  }

  async function onLogoFileChange(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    try {
      const dataUrl = await readFileAsDataUrl(selected);
      updateSetting("customLogoDataUrl", dataUrl);
      updateSetting("customLogoName", selected.name);
      setResult("");
    } catch (error) {
      alert(error.message || "Could not load custom logo.");
    }
  }

  function resetFrame() {
    setTransform({ zoom: 1, x: 0, y: 0 });
  }

  function resetCustomLogo() {
    updateSetting("customLogoDataUrl", "");
    updateSetting("customLogoName", "");
    setResult("");
  }

  function onPointerDown(e) {
    setDragging(true);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: transform.x,
      startY: transform.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - dragRef.current.x) / rect.width;
    const dy = (e.clientY - dragRef.current.y) / rect.height;
    setTransform((t) => ({
      ...t,
      x: Math.max(-0.75, Math.min(0.75, dragRef.current.startX + dx)),
      y: Math.max(-0.75, Math.min(0.75, dragRef.current.startY + dy)),
    }));
  }

  function onPointerUp() {
    setDragging(false);
  }

  async function generate() {
    if (!file) return;
    setIsWorking(true);
    setResult("");
    setStage("Starting...");

    try {
      const final = await createFinalImage({
        file,
        settings,
        transform,
        logo: logoRef.current,
        setStage,
      });
      setResult(final);
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
      await navigator.share({ files: [shareFile], title: "iCOOL Branded Photo" });
    } else {
      window.open(result, "_blank");
    }
  }

  const frame = getFrame(settings);
  const canGenerate = useMemo(() => !!file && !isWorking, [file, isWorking]);
  const overlay = previewOverlayStyle(settings);
  const headerLogo = settings.customLogoDataUrl || "/icool-logo.png";

  return (
    <main>
      <header className="hero">
        <div>
          <img className="brandLogo" src={headerLogo} alt="Brand logo" />
          <h1>iCOOL Photo Branding App</h1>
          <p>
            Continue on the professional v13 interface with custom logo upload,
            custom footer colors, flexible frame control, and a polished branded export.
          </p>
        </div>
        <div className="versionCard">
          <b>{VERSION}</b>
          <span>Same professional interface, now with uploaded logo support and editable footer colors.</span>
        </div>
      </header>

      <section className="grid">
        <div className="card controls">
          <label>Upload photo</label>
          <input type="file" accept="image/*" onChange={onFileChange} />

          {file && (
            <div className="fileInfo">
              Selected: {file.name}
              <br />
              Size: {fileSize}
            </div>
          )}

          <label>Frame type before starting</label>
          <select
            value={settings.frame}
            onChange={(e) => {
              updateSetting("frame", e.target.value);
              setTransform({ zoom: 1, x: 0, y: 0 });
              setResult("");
            }}
          >
            <option value="portrait">Portrait 4:5</option>
            <option value="landscape">Landscape 16:9</option>
            <option value="square">Square 1:1</option>
            <option value="story">Story 9:16</option>
          </select>

          <label>Project type</label>
          <select value={settings.industry} onChange={(e) => updateSetting("industry", e.target.value)}>
            <option value="auto">Auto / General</option>
            <option value="construction">Construction / Finishing</option>
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

          <label>Cleanup strength</label>
          <select value={settings.cleanup} onChange={(e) => updateSetting("cleanup", e.target.value)}>
            <option value="off">Off</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="strong">Strong - tiny dirt cleanup</option>
          </select>

          <label>Professional AI cleanup</label>
          <select value={settings.aiCleanup} onChange={(e) => updateSetting("aiCleanup", e.target.value)}>
            <option value="off">Off - local only</option>
            <option value="on">On - reserved for future server setup</option>
          </select>

          <div className="hint">
            This build is stable on GitHub + Vercel without server API dependencies.
            Local enhancement and cleanup remain active.
          </div>

          <label>Output quality</label>
          <select value={settings.outputQuality} onChange={(e) => updateSetting("outputQuality", e.target.value)}>
            <option value="light">Fast / lighter</option>
            <option value="pro">Professional</option>
            <option value="high">High quality</option>
          </select>

          <div className="sectionTitle">Logo controls</div>
          <label>Upload custom logo</label>
          <input type="file" accept="image/png,image/webp,image/svg+xml,image/jpeg" onChange={onLogoFileChange} />
          {(settings.customLogoDataUrl || settings.customLogoName) && (
            <div className="fileInfo">
              Active logo: {settings.customLogoName || "Custom uploaded logo"}
            </div>
          )}
          <div className="inlineButtons">
            <button type="button" className="secondaryBtn smallBtn" onClick={resetCustomLogo}>
              Use default iCOOL logo
            </button>
          </div>

          <label>Logo fog background</label>
          <select value={settings.logoPlate} onChange={(e) => updateSetting("logoPlate", e.target.value)}>
            <option value="foggy">Foggy transparent</option>
            <option value="strong">Stronger fog</option>
            <option value="none">No fog</option>
          </select>

          <label>Logo scale</label>
          <select value={settings.logoScale} onChange={(e) => updateSetting("logoScale", e.target.value)}>
            <option value="85">Small</option>
            <option value="100">Normal</option>
            <option value="115">Large</option>
            <option value="130">Extra large</option>
          </select>

          <label>Logo position X</label>
          <input type="range" min="-20" max="20" step="1" value={settings.logoOffsetX} onChange={(e) => updateSetting("logoOffsetX", e.target.value)} />
          <label>Logo position Y</label>
          <input type="range" min="-20" max="20" step="1" value={settings.logoOffsetY} onChange={(e) => updateSetting("logoOffsetY", e.target.value)} />

          <div className="sectionTitle">Slogan controls</div>
          <label>Show slogan</label>
          <select value={settings.showSlogan} onChange={(e) => updateSetting("showSlogan", e.target.value)}>
            <option value="yes">Yes</option>
            <option value="no">No, logo only</option>
          </select>

          <label>Slogan font family</label>
          <select value={settings.sloganFontFamily} onChange={(e) => updateSetting("sloganFontFamily", e.target.value)}>
            <option value="Arial, Helvetica, sans-serif">Arial / Helvetica</option>
            <option value="'Trebuchet MS', Arial, sans-serif">Trebuchet</option>
            <option value="'Gill Sans', Arial, sans-serif">Gill Sans</option>
            <option value="Georgia, 'Times New Roman', serif">Georgia</option>
            <option value="'Palatino Linotype', Georgia, serif">Palatino</option>
          </select>

          <label>Slogan font size</label>
          <select value={settings.sloganFontScale} onChange={(e) => updateSetting("sloganFontScale", e.target.value)}>
            <option value="85">Small</option>
            <option value="100">Normal</option>
            <option value="115">Large</option>
            <option value="130">Extra large</option>
          </select>

          <label>Slogan fog background</label>
          <select value={settings.sloganPlate} onChange={(e) => updateSetting("sloganPlate", e.target.value)}>
            <option value="foggy">Foggy transparent</option>
            <option value="strong">Stronger fog</option>
            <option value="none">No fog</option>
          </select>

          <label>Slogan position X</label>
          <input type="range" min="-30" max="30" step="1" value={settings.sloganOffsetX} onChange={(e) => updateSetting("sloganOffsetX", e.target.value)} />
          <label>Slogan position Y</label>
          <input type="range" min="-20" max="20" step="1" value={settings.sloganOffsetY} onChange={(e) => updateSetting("sloganOffsetY", e.target.value)} />

          <label>Optional slogan override</label>
          <input
            type="text"
            placeholder="Leave empty for smart slogan"
            value={settings.customSlogan}
            onChange={(e) => updateSetting("customSlogan", e.target.value)}
          />

          <div className="sectionTitle">Footer content</div>
          <label>Footer scale</label>
          <select value={settings.footerScale} onChange={(e) => updateSetting("footerScale", e.target.value)}>
            <option value="90">Slim</option>
            <option value="100">Normal</option>
            <option value="115">Large</option>
          </select>

          <label>Address / location</label>
          <input value={settings.locationText} onChange={(e) => updateSetting("locationText", e.target.value)} placeholder="Lebanon" />

          <label>Phone text</label>
          <input value={settings.phoneText} onChange={(e) => updateSetting("phoneText", e.target.value)} placeholder="Mobile: 03 715 512" />

          <label>Company services</label>
          <input value={settings.servicesText} onChange={(e) => updateSetting("servicesText", e.target.value)} placeholder="HVAC SOLAR MEP SOLUTIONS" />

          <div className="sectionTitle">Footer colors</div>
          <div className="colorGrid">
            <label className="colorField">
              <span>Main blue</span>
              <input type="color" value={settings.footerBlueColor} onChange={(e) => updateSetting("footerBlueColor", e.target.value)} />
            </label>
            <label className="colorField">
              <span>Deep blue</span>
              <input type="color" value={settings.footerDeepBlueColor} onChange={(e) => updateSetting("footerDeepBlueColor", e.target.value)} />
            </label>
            <label className="colorField">
              <span>Accent orange</span>
              <input type="color" value={settings.footerOrangeColor} onChange={(e) => updateSetting("footerOrangeColor", e.target.value)} />
            </label>
            <label className="colorField">
              <span>Text / icon color</span>
              <input type="color" value={settings.footerTextColor} onChange={(e) => updateSetting("footerTextColor", e.target.value)} />
            </label>
          </div>

          <button
            type="button"
            className="secondaryBtn"
            onClick={() => {
              setSettings(defaultSettings);
              localStorage.removeItem("icoolV13Settings");
              localStorage.removeItem("icoolV14Settings");
              resetFrame();
              setResult("");
            }}
          >
            Reset Settings
          </button>

          <button type="button" onClick={generate} disabled={!canGenerate}>
            {isWorking ? stage || "Processing..." : "Generate Branded Photo"}
          </button>
        </div>

        <div className="card previewCard">
          <div className="frameTools">
            <div>
              <b>Adjust frame</b>
              <span>{frame.label}</span>
            </div>
            <button type="button" className="smallBtn" onClick={resetFrame}>
              Reset Frame
            </button>
          </div>

          <div
            className={`cropArea ${settings.frame}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {previewUrl ? (
              <img
                className="cropImage"
                src={previewUrl}
                alt="Frame preview"
                style={{ transform: `translate(${transform.x * 100}%, ${transform.y * 100}%) scale(${transform.zoom})` }}
                draggable={false}
              />
            ) : (
              <div className="placeholder">Upload a photo, then move and zoom it inside the frame.</div>
            )}

            <div className="safeFooter" style={{ background: `${settings.footerBlueColor}44` }} />
            <div className={`safeLogoPreview ${settings.logoPlate !== "none" ? "fog" : ""}`} style={overlay.logo}>Logo</div>
            {settings.showSlogan === "yes" && (
              <div className={`safeSloganPreview ${settings.sloganPlate !== "none" ? "fog" : ""}`} style={overlay.slogan}>
                Slogan
              </div>
            )}
            <div className="gridLines" />
          </div>

          <label>Zoom</label>
          <input type="range" min="1" max="2.8" step="0.01" value={transform.zoom} onChange={(e) => setTransform((t) => ({ ...t, zoom: Number(e.target.value) }))} />

          <div className="panGrid">
            <label>
              Move X
              <input type="range" min="-0.75" max="0.75" step="0.01" value={transform.x} onChange={(e) => setTransform((t) => ({ ...t, x: Number(e.target.value) }))} />
            </label>
            <label>
              Move Y
              <input type="range" min="-0.75" max="0.75" step="0.01" value={transform.y} onChange={(e) => setTransform((t) => ({ ...t, y: Number(e.target.value) }))} />
            </label>
          </div>

          <div className="resultBox">
            {result ? <img src={result} alt="Final branded result" /> : <div className="placeholder small">Generated result will appear here.</div>}
          </div>

          {result && (
            <div className="actions">
              <a href={result} download="icool-branded-photo.jpg">
                Download
              </a>
              <button type="button" onClick={shareResult}>
                Share
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
