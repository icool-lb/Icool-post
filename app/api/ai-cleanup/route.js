export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function GET() {
  return json({ ok: true, version: "v15-pro", message: "iCOOL AI cleanup API is available" });
}

export async function POST(req) {
  try {
    const { image, cleanupPrompt } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return json({
        ok: false,
        fallback: true,
        message: "OPENAI_API_KEY is not configured in Vercel."
      });
    }

    if (!image || !String(image).startsWith("data:image/")) {
      return json({ ok: false, fallback: true, message: "Missing image data." });
    }

    const base64 = image.split(",")[1];
    const mime = image.substring(5, image.indexOf(";")) || "image/jpeg";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    if (bytes.byteLength > 8 * 1024 * 1024) {
      return json({
        ok: false,
        fallback: true,
        message: "Image payload is too large. Use Professional or Fast output instead of High Quality."
      });
    }

    const form = new FormData();
    form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
    form.append("image[]", new Blob([bytes], { type: mime }), "photo.jpg");
    form.append(
      "prompt",
      cleanupPrompt ||
        "Photorealistic professional cleanup of this real installation/project photo. Improve lighting, clarity, white balance and contrast. Remove small trash, dust, stains, debris and clutter. Preserve all equipment, electrical wiring routes, walls, camera angle, proportions, and people/faces if present. Do not add logo, text, branding or artificial objects. Keep the result realistic."
    );
    form.append("n", "1");
    form.append("quality", process.env.OPENAI_IMAGE_QUALITY || "medium");
    form.append("size", "auto");
    form.append("background", "auto");
    form.append("input_fidelity", "high");
    form.append("output_format", "jpeg");
    form.append("output_compression", "92");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return json({
        ok: false,
        fallback: true,
        message: "OpenAI image edit failed.",
        detail: detail.slice(0, 900),
      });
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;

    if (!b64) {
      return json({ ok: false, fallback: true, message: "OpenAI returned no image." });
    }

    return json({ ok: true, image: `data:image/jpeg;base64,${b64}` });
  } catch (error) {
    return json({
      ok: false,
      fallback: true,
      message: "AI cleanup route error.",
      detail: String(error?.message || error).slice(0, 900),
    });
  }
}
