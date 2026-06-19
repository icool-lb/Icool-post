import sharp from "sharp";
import OpenAI from "openai";
import { buildFooterSvg, buildTextSvg, pickFallbackSlogan } from "@/lib/design";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_INPUT_MB = 18;

async function generateSmartSlogan(buffer, mime, industry, customSlogan) {
  if (customSlogan?.trim()) return customSlogan.trim();

  if (!process.env.OPENAI_API_KEY) {
    return pickFallbackSlogan(industry);
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const base64 = buffer.toString("base64");

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
          {
            type: "input_image",
            image_url: `data:${mime};base64,${base64}`
          }
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
    return { brightness: 1.05, saturation: 1.12, contrast: 1.12, sharpen: { sigma: 1.25, m1: 1.35, m2: 0.65 } };
  }
  if (level === "light") {
    return { brightness: 1.02, saturation: 1.05, contrast: 1.05, sharpen: { sigma: 0.85, m1: 1.05, m2: 0.35 } };
  }
  return { brightness: 1.035, saturation: 1.08, contrast: 1.08, sharpen: { sigma: 1.0, m1: 1.18, m2: 0.45 } };
}

async function enhance(buffer, cleanup) {
  const settings = cleanupSettings(cleanup);

  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: 2200,
      height: 2200,
      fit: "inside",
      withoutEnlargement: false
    })
    .median(cleanup === "strong" ? 1 : 0)
    .normalise({ lower: 1, upper: 99 })
    .modulate({
      brightness: settings.brightness,
      saturation: settings.saturation
    })
    .linear(settings.contrast, -(128 * settings.contrast) + 128)
    .sharpen(settings.sharpen)
    .png()
    .toBuffer();
}

async function createBrandedImage(buffer, mime, industry, cleanup, customSlogan) {
  const slogan = await generateSmartSlogan(buffer, mime, industry, customSlogan);

  const enhanced = await enhance(buffer, cleanup);
  const image = sharp(enhanced);
  const meta = await image.metadata();
  const width = meta.width;
  const height = meta.height;

  const footerHeight = Math.max(110, Math.round(height * 0.105));

  const logoInput = await sharp("public/icool-logo.png").metadata();
  const logoWidth = width >= height ? Math.round(width * 0.24) : Math.round(width * 0.31);
  const logoHeight = Math.round(logoWidth * logoInput.height / logoInput.width);
  const logoX = Math.round(width * 0.035);
  const logoY = height - footerHeight - logoHeight - Math.round(height * 0.025);

  const footerSvg = Buffer.from(buildFooterSvg(width, height, footerHeight));
  const textSvg = Buffer.from(buildTextSvg(width, height, footerHeight, slogan, {
    x: logoX, y: logoY, w: logoWidth, h: logoHeight
  }));

  const logo = await sharp("public/icool-logo.png")
    .resize({ width: logoWidth })
    .png()
    .toBuffer();

  return sharp(enhanced)
    .composite([
      { input: textSvg, left: 0, top: 0 },
      { input: logo, left: logoX, top: Math.max(20, logoY) },
      { input: footerSvg, left: 0, top: 0 }
    ])
    .png()
    .toBuffer();
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("image");

    if (!file || typeof file === "string") {
      return new Response("Missing image file", { status: 400 });
    }

    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
      return new Response(`Image is too large. Max ${MAX_INPUT_MB}MB.`, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const industry = String(form.get("industry") || "auto");
    const cleanup = String(form.get("cleanup") || "medium");
    const customSlogan = String(form.get("customSlogan") || "");
    const mime = file.type || "image/jpeg";

    const output = await createBrandedImage(buffer, mime, industry, cleanup, customSlogan);

    return new Response(output, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="icool-branded-photo.png"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(error?.message || "Processing failed", { status: 500 });
  }
}
