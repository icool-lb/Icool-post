export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const fallback = { hvac:"Engineered Ventilation, Built to Perform.", solar:"Clean Energy, Built for Tomorrow.", mep:"Reliable Systems, Professional Execution.", lighting:"Beautiful Pathways, Professionally Illuminated.", inventory:"Quality Units, Ready to Deliver.", team:"People Behind Smart Energy.", auto:"Quality Work, Delivered with Confidence." };
export async function POST(req){
  try{
    const { image, industry="auto" } = await req.json();
    if(!process.env.OPENAI_API_KEY || !image) return Response.json({slogan:fallback[industry]||fallback.auto});
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", input:[{ role:"user", content:[{ type:"input_text", text:`Create one short premium marketing slogan for iCOOL based on this image. Industry hint: ${industry}. Max 9 words. English only. Do not mention brand names or hashtags.` }, { type:"input_image", image_url:image }] }] });
    const slogan=(response.output_text||"").replace(/["“”]/g,"").trim();
    return Response.json({slogan:slogan || fallback[industry] || fallback.auto});
  } catch { return Response.json({slogan:fallback.auto}); }
}
