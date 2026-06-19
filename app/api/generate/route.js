import sharp from "sharp";
import path from "path";
import { buildFooterSvg, buildTextSvg, pickFallbackSlogan } from "../../../lib/design.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_INPUT_MB = 4.2;
const LOGO_PATH = path.join(process.cwd(), "public", "icool-logo.png");

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function plainError(message, status = 500) {
  return new Response(String(message), {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function GET() {
  return new Response("iCOOL generate API is working", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
}

async function generateSmartSlogan(buffer, mime, industry, customSlogan) {
  if (customSlogan?.trim()) return customSlogan.trim();

  if (!process.env.OPENAI_API_KEY) {
    return pickFallbackSlogan(industry);
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const preview = await sharp(buffer)
      .rotate()
      .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();

    const base64 = preview.toString("base64");

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Create one short premium marketing slogan for iCOOL based on this image. ` +
              `Industry hint: ${industry}. ` +
              `It must be natural, professional, max 9 words, English only. ` +
              `Do not mention a brand name. Do not use hashtags.`
          },
          { type: "input_image", image_url: `data:image/jpeg;base64,${base64}` }
        ]
      }]
    });

    const text = (response.output_text || "").replace(/["“”]/g, "").trim();
    return text || pickFallbackSlogan(industry);
  } catch (error) {
    console.warn("Slogan generation failed:", error?.message);
    return pickFallbackSlogan(industry);
  }
}

function cleanupSettings(level) {
  if (level === "strong") {
    return { brightness: 1.05, saturation: 1.12, contrast: 1.12, sharpen: { sigma: 1.25, m1: 1.35, m2: 0.65 }, median: true };
  }
  if (level === "light") {
    return { brightness: 1.02, saturation: 1.05, contrast: 1.05, sharpen: { sigma: 0.85, m1: 1.05, m2: 0.35 }, median: false };
  }
  return { brightness: 1.035, saturation: 1.08, contrast: 1.08, sharpen: { sigma: 1.0, m1: 1.18, m2: 0.45 }, median: false };
}

async function enhance(buffer, cleanup) {
  const settings = cleanupSettings(cleanup);

  let pipeline = sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: 1850,
      height: 1850,
      fit: "inside",
      withoutEnlargement: false
    });

  if (settings.median) pipeline = pipeline.median(1);

  return pipeline
    .normalise({ lower: 1, upper: 99 })
    .modulate({ brightness: settings.brightness, saturation: settings.saturation })
    .linear(settings.contrast, -(128 * settings.contrast) + 128)
    .sharpen(settings.sharpen)
    .png()
    .toBuffer();
}

async function createBrandedImage(buffer, mime, industry, cleanup, customSlogan, logoScaleRaw, footerScaleRaw) {
  const slogan = await generateSmartSlogan(buffer, mime, industry, customSlogan);
  const enhanced = await enhance(buffer, cleanup);

  const meta = await sharp(enhanced).metadata();
  const width = meta.width;
  const height = meta.height;

  if (!width || !height) throw new Error("Could not read image dimensions.");

  const footerScale = clampNumber(footerScaleRaw, 80, 125, 100) / 100;
  const logoScale = clampNumber(logoScaleRaw, 75, 125, 100) / 100;
  const footerHeight = Math.max(86, Math.round(height * 0.105 * footerScale));

  const logoInput = await sharp(LOGO_PATH).metadata();
  const baseLogoWidth = width >= height ? Math.round(width * 0.24) : Math.round(width * 0.31);
  const logoWidth = Math.round(baseLogoWidth * logoScale);
  const logoHeight = Math.round(logoWidth * logoInput.height / logoInput.width);
  const logoX = Math.round(width * 0.035);
  const logoY = Math.max(20, height - footerHeight - logoHeight - Math.round(height * 0.025));

  const footerSvg = Buffer.from(buildFooterSvg(width, height, footerHeight));
  const textSvg = Buffer.from(buildTextSvg(width, height, footerHeight, slogan, { x: logoX, y: logoY, w: logoWidth, h: logoHeight }));
  const logo = await sharp(LOGO_PATH).resize({ width: logoWidth }).png().toBuffer();

  return sharp(enhanced)
    .composite([
      { input: textSvg, left: 0, top: 0 },
      { input: logo, left: logoX, top: logoY },
      { input: footerSvg, left: 0, top: 0 }
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("image");

    if (!file || typeof file === "string") return plainError("Missing image file", 400);

    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
      return plainError(`Image is too large after compression. Max ${MAX_INPUT_MB}MB.`, 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const industry = String(form.get("industry") || "auto");
    const cleanup = String(form.get("cleanup") || "medium");
    const customSlogan = String(form.get("customSlogan") || "");
    const logoScale = String(form.get("logoScale") || "100");
    const footerScale = String(form.get("footerScale") || "100");
    const mime = file.type || "image/jpeg";

    const output = await createBrandedImage(buffer, mime, industry, cleanup, customSlogan, logoScale, footerScale);

    return new Response(output, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'inline; filename="icool-branded-photo.jpg"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("iCOOL API error:", error);
    return plainError(error?.message || "Processing failed", 500);
  }
}
