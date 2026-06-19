export const BRAND = {
  blue: "#005696",
  deepBlue: "#003f7d",
  orange: "#f25b22",
  white: "#ffffff",
  navy: "#12385d",
  phone: "03 715 512",
  location: "Lebanon",
  services: "HVAC SOLAR MEP SOLUTIONS",
};

export const FALLBACK_SLOGANS = {
  hvac: [
    "Comfort in Every Space, Quality in Every Detail.",
    "Precision Climate Solutions, Built to Last.",
    "Engineered Comfort, Delivered with Care.",
  ],
  solar: [
    "Clean Energy, Built for Tomorrow.",
    "Harvest the Sun, Power Your Life.",
    "Smart Homes, Sustainable Power.",
  ],
  mep: [
    "Reliable Systems, Professional Execution.",
    "Engineered Solutions for Every Detail.",
    "Power, Control, and Performance.",
  ],
  lighting: [
    "Lighting the Way with Elegance and Care.",
    "Beautiful Pathways, Professionally Illuminated.",
  ],
  inventory: [
    "Stocked for Every Cooling Solution.",
    "Quality Units, Ready to Deliver.",
    "Large Inventory, Ready When You Are.",
  ],
  finishing: [
    "Modern Comfort in Every Detail.",
    "Elegant Finishing, Premium Comfort.",
  ],
  team: [
    "People Behind Smart Energy.",
    "Learning Today, Leading Tomorrow.",
  ],
  auto: [
    "Professional Solutions, Built for Real Projects.",
    "Quality Work, Delivered with Confidence.",
    "Clean Execution, Reliable Performance.",
  ],
};

export function pickFallbackSlogan(industry = "auto") {
  const list = FALLBACK_SLOGANS[industry] || FALLBACK_SLOGANS.auto;
  return list[Math.floor(Math.random() * list.length)];
}

export function escapeXml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function wrapText(text, maxChars = 38) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 2);
}

export function buildFooterSvg(width, height, footerHeight) {
  const y = height - footerHeight;
  const diag = Math.round(width * 0.08);
  const orangeStart = Math.round(width * 0.62);
  const fontSize = Math.max(24, Math.round(footerHeight * 0.24));
  const icon = Math.max(32, Math.round(footerHeight * 0.32));
  const cy = y + footerHeight / 2;

  return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${y}" width="${width}" height="${footerHeight}" fill="${BRAND.deepBlue}"/>
    <rect x="0" y="${y}" width="${Math.round(width * 0.66)}" height="${footerHeight}" fill="${BRAND.blue}"/>
    <polygon points="${orangeStart + diag},${y} ${width},${y} ${width},${height} ${orangeStart},${height}" fill="${BRAND.orange}"/>
    <line x1="${orangeStart + diag}" y1="${y}" x2="${orangeStart}" y2="${height}" stroke="#fff" stroke-width="${Math.max(4, Math.round(width/350))}"/>

    <circle cx="${Math.round(width * 0.055)}" cy="${cy}" r="${icon/2}" fill="#fff"/>
    <text x="${Math.round(width * 0.055)}" y="${cy + fontSize*0.34}" text-anchor="middle" font-family="Arial" font-size="${fontSize}" font-weight="700" fill="${BRAND.blue}">⌖</text>
    <text x="${Math.round(width * 0.085)}" y="${cy + fontSize*0.36}" font-family="Arial" font-size="${fontSize}" fill="#fff">${BRAND.location}</text>

    <circle cx="${Math.round(width * 0.34)}" cy="${cy}" r="${icon/2}" fill="#fff"/>
    <text x="${Math.round(width * 0.34)}" y="${cy + fontSize*0.34}" text-anchor="middle" font-family="Arial" font-size="${fontSize}" font-weight="700" fill="${BRAND.blue}">☎</text>
    <text x="${Math.round(width * 0.37)}" y="${cy + fontSize*0.36}" font-family="Arial" font-size="${fontSize}" fill="#fff">Mobile: ${BRAND.phone}</text>

    <text x="${Math.round(width * 0.96)}" y="${cy + fontSize*0.36}" text-anchor="end" font-family="Arial" font-size="${fontSize}" font-weight="800" fill="#fff">${BRAND.services}</text>
  </svg>`;
}

export function buildTextSvg(width, height, footerHeight, slogan, logoBox) {
  const maxChars = width >= height ? 44 : 32;
  const lines = wrapText(slogan, maxChars);
  const fontSize = width >= height ? Math.max(28, Math.round(width * 0.030)) : Math.max(28, Math.round(width * 0.046));
  const yBase = height - footerHeight - Math.round(height * 0.080);
  const x = width >= height
    ? Math.min(logoBox.x + logoBox.w + Math.round(width * 0.035), Math.round(width * 0.50))
    : Math.round(width * 0.08);

  const lineHeight = Math.round(fontSize * 1.22);
  const textLines = lines.map((line, i) => {
    const safe = escapeXml(line);
    const y = yBase + i * lineHeight;
    return `
      <text x="${x + 2}" y="${y + 2}" font-family="Arial" font-size="${fontSize}" font-style="italic" font-weight="700" fill="rgba(255,255,255,.90)">${safe}</text>
      <text x="${x}" y="${y}" font-family="Arial" font-size="${fontSize}" font-style="italic" font-weight="700" fill="${BRAND.navy}">${safe}</text>
    `;
  }).join("");

  return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity=".78"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${height - footerHeight - Math.round(height * 0.22)}" width="${width}" height="${Math.round(height * 0.22)}" fill="url(#fade)"/>
    ${textLines}
  </svg>`;
}
