import { NextResponse } from "next/server";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_OUTPUT_WIDTH = 1600;
const LOGO_FILE = "icool-logo.png";

function safeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .trim();
}

function pickFormValue(formData, names, fallback = "") {
  for (const name of names) {
    const value = formData.get(name);
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
}

function pickFile(formData) {
  const names = ["photo", "file", "image", "upload", "input"];
  for (const name of names) {
    const file = formData.get(name);
    if (file && typeof file.arrayBuffer === "function") return file;
  }
  return null;
}

async function loadLogoBuffer() {
  const logoPath = path.join(process.cwd(), "public", LOGO_FILE);

  try {
    return await fs.readFile(logoPath);
  } catch (error) {
    // Fallback حتى لا يفشل التوليد إذا تغيّر مكان الملف أو لم يصل إلى Vercel.
    // يبقى الأفضل أن يكون الملف موجودًا في: public/icool-logo.png
    const fallbackSvg = `
      <svg width="900" height="260" viewBox="0 0 900 260" xmlns="http://www.w3.org/2000/svg">
        <rect width="900" height="260" rx="34" fill="white" opacity="0.96"/>
        <circle cx="130" cy="130" r="72" fill="none" stroke="#005696" stroke-width="18"/>
        <path d="M130 52 L130 208" stroke="#005696" stroke-width="14" stroke-linecap="round"/>
        <path d="M92 130 H168" stroke="#005696" stroke-width="14" stroke-linecap="round"/>
        <path d="M130 78 L103 105 M130 78 L157 105 M130 182 L103 155 M130 182 L157 155" stroke="#005696" stroke-width="10" stroke-linecap="round"/>
        <path d="M130 58 A72 72 0 0 1 130 202 Z" fill="#f25b38" opacity="0.95"/>
        <text x="240" y="135" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="700" fill="#005696">iCOOL</text>
        <text x="248" y="190" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500" letter-spacing="10" fill="#005696">COOL YOUR LIFE</text>
      </svg>`;
    return Buffer.from(fallbackSvg);
  }
}

function makeSlogan(projectType, override) {
  const custom = String(override || "").trim();
  if (custom) return custom;

  const type = String(projectType || "").toLowerCase();

  if (type.includes("solar") || type.includes("pv") || type.includes("energy")) {
    return "Smart energy. Reliable performance.";
  }

  if (
    type.includes("ac") ||
    type.includes("hvac") ||
    type.includes("air") ||
    type.includes("cool") ||
    type.includes("conditioning")
  ) {
    return "Installed with precision. Cooling you can trust.";
  }

  if (type.includes("duct") || type.includes("vent")) {
    return "Clean execution. Professional airflow.";
  }

  return "Professional finish by iCOOL.";
}

function cleanupPreset(cleanupStrength) {
  const value = String(cleanupStrength || "").toLowerCase();

  if (value.includes("strong")) {
    return {
      brightness: 1.04,
      saturation: 1.08,
      gamma: 1.02,
      sharpenSigma: 1.15,
      quality: 94,
    };
  }

  if (value.includes("light")) {
    return {
      brightness: 1.015,
      saturation: 1.025,
      gamma: 1.0,
      sharpenSigma: 0.65,
      quality: 92,
    };
  }

  return {
    brightness: 1.03,
    saturation: 1.05,
    gamma: 1.01,
    sharpenSigma: 0.9,
    quality: 93,
  };
}

function makeTextOverlaySvg({ width, height, slogan }) {
  const safeSlogan = safeText(slogan);
  const footerHeight = Math.max(150, Math.round(height * 0.14));
  const titleSize = Math.max(34, Math.round(width * 0.035));
  const sloganSize = Math.max(22, Math.round(width * 0.022));
  const padding = Math.max(34, Math.round(width * 0.035));
  const footerY = height - footerHeight;

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="footer" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#003a66" stop-opacity="0.92"/>
          <stop offset="0.56" stop-color="#005696" stop-opacity="0.88"/>
          <stop offset="1" stop-color="#0a88c8" stop-opacity="0.84"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.35"/>
        </filter>
      </defs>

      <rect x="0" y="${footerY}" width="${width}" height="${footerHeight}" fill="url(#footer)"/>
      <rect x="0" y="${footerY}" width="${width}" height="5" fill="#f25b38" opacity="0.95"/>

      <text x="${padding}" y="${footerY + Math.round(footerHeight * 0.45)}"
        font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800"
        fill="#ffffff" filter="url(#shadow)">iCOOL Trading &amp; Contracting</text>

      <text x="${padding}" y="${footerY + Math.round(footerHeight * 0.75)}"
        font-family="Arial, Helvetica, sans-serif" font-size="${sloganSize}" font-weight="500"
        fill="#eaf6ff" filter="url(#shadow)">${safeSlogan}</text>
    </svg>`);
}

export async function POST(request) {
  try {
    const formData = await request.formData();

    const file = pickFile(formData);
    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No photo was uploaded. Use field name: photo, file, image, upload, or input." },
        { status: 400 }
      );
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    if (!inputBuffer.length) {
      return NextResponse.json({ ok: false, error: "Uploaded image is empty." }, { status: 400 });
    }

    const projectType = pickFormValue(formData, ["projectType", "project_type", "type"], "Auto detect");
    const cleanupStrength = pickFormValue(formData, ["cleanupStrength", "cleanup_strength", "strength"], "Medium");
    const sloganOverride = pickFormValue(formData, ["sloganOverride", "slogan", "caption"], "");
    const slogan = makeSlogan(projectType, sloganOverride);
    const preset = cleanupPreset(cleanupStrength);

    const base = sharp(inputBuffer, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_OUTPUT_WIDTH, withoutEnlargement: true })
      .normalise()
      .modulate({ brightness: preset.brightness, saturation: preset.saturation })
      .gamma(preset.gamma)
      .sharpen({ sigma: preset.sharpenSigma, m1: 0.8, m2: 2.2 });

    const meta = await base.metadata();
    const width = meta.width || MAX_OUTPUT_WIDTH;
    const height = meta.height || Math.round(MAX_OUTPUT_WIDTH * 0.75);

    const logoOriginal = await loadLogoBuffer();
    const logoWidth = Math.max(190, Math.min(330, Math.round(width * 0.19)));
    const logo = await sharp(logoOriginal, { failOn: "none" })
      .resize({ width: logoWidth, withoutEnlargement: true })
      .png()
      .toBuffer();

    const logoMeta = await sharp(logo).metadata();
    const margin = Math.max(26, Math.round(width * 0.025));
    const logoBackgroundPadding = Math.max(12, Math.round(width * 0.009));
    const logoBackground = Buffer.from(`
      <svg width="${(logoMeta.width || logoWidth) + logoBackgroundPadding * 2}" height="${(logoMeta.height || 90) + logoBackgroundPadding * 2}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100%" height="100%" rx="18" fill="white" opacity="0.88"/>
      </svg>`);

    const logoWithBackground = await sharp(logoBackground)
      .composite([{ input: logo, left: logoBackgroundPadding, top: logoBackgroundPadding }])
      .png()
      .toBuffer();

    const textOverlay = makeTextOverlaySvg({ width, height, slogan });

    const outputBuffer = await base
      .composite([
        { input: logoWithBackground, left: margin, top: margin },
        { input: textOverlay, left: 0, top: 0 },
      ])
      .jpeg({ quality: preset.quality, mozjpeg: true })
      .toBuffer();

    const dataUrl = `data:image/jpeg;base64,${outputBuffer.toString("base64")}`;

    return NextResponse.json(
      {
        ok: true,
        mime: "image/jpeg",
        slogan,
        projectType,
        cleanupStrength,
        image: dataUrl,
        imageUrl: dataUrl,
        result: dataUrl,
        output: dataUrl,
        dataUrl,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Generation failed:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Generation failed." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "iCOOL photo branding API is running.",
    logo: "/icool-logo.png",
  });
}
