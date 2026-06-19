# iCOOL Photo Branding App

A small Next.js PWA for realistic project-photo enhancement, exact iCOOL logo overlay, fixed footer, and smart slogan generation.

## What it does

- Upload real photo
- Improve lighting, contrast, color and clarity
- Keep the original scene realistic
- Add the exact iCOOL logo from `public/icool-logo.png`
- Add footer: Lebanon | Mobile: 03 715 512 | HVAC SOLAR MEP SOLUTIONS
- Generate a slogan from the image using OpenAI Vision
- If no OpenAI key is set, it uses professional fallback slogans

## Setup

```bash
npm install
npm run dev
```

Open:

```bash
http://localhost:3000
```

## Environment variable on Vercel

Add:

```bash
OPENAI_API_KEY=your_key_here
```

Optional:

```bash
OPENAI_MODEL=gpt-4.1-mini
```

## Deploy to Vercel

1. Upload this folder to GitHub.
2. Import the repository in Vercel.
3. Add `OPENAI_API_KEY` in Project Settings > Environment Variables.
4. Deploy.
5. On iPhone: open the Vercel link in Safari > Share > Add to Home Screen.

## Important

This app does not regenerate the full image. It uses photo finishing and overlays, so faces and project details remain natural.


## Fix included in v2

This version fixes the Vercel error:

`Module not found: Can't resolve '@/lib/design'`

It adds `jsconfig.json`, changes the API route import to a relative import, and includes a compatibility route at `/api/generator`.
