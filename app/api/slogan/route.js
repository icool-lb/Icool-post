export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const FALLBACKS = {
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

function fallback(industry = "auto") {
  const list = FALLBACKS[industry] || FALLBACKS.auto;
  return list[Math.floor(Math.random() * list.length)];
}

export async function GET() {
  return Response.json({ ok: true, version: "v9-clean", message: "iCOOL slogan API is working" });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { image, industry = "auto" } = body;

    // The app works perfectly without OpenAI. This route is optional only.
    if (!process.env.OPENAI_API_KEY || !image) {
      return Response.json({ slogan: fallback(industry), source: "fallback" });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Create one short premium marketing slogan for iCOOL based on this image. ` +
                `Industry hint: ${industry}. English only. Max 9 words. ` +
                `Do not mention brand names, hashtags, emojis, or quotation marks.`
            },
            { type: "input_image", image_url: image }
          ]
        }]
      })
    });

    if (!response.ok) {
      return Response.json({ slogan: fallback(industry), source: "fallback" });
    }

    const data = await response.json();
    const text = String(data.output_text || "").replace(/["“”]/g, "").trim();
    return Response.json({ slogan: text || fallback(industry), source: text ? "openai" : "fallback" });
  } catch {
    return Response.json({ slogan: fallback("auto"), source: "fallback" });
  }
}
