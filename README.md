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


## v3 fixes

- Fixed settings button touch on iPhone using `onPointerUp`, high `z-index`, and safe-area support.
- Settings now persist in `localStorage`.
- Parameters are now actually sent to the API: project type, cleanup strength, logo scale, footer scale, slogan override.
- Fixed Sharp processing bug by not calling `median(0)`.
- Added robust logo path using `process.cwd()`.
- Kept `/api/generator` as a compatibility route, but the main route is `/api/generate`.


## v4 fix for HTML error

If the app shows `Generation failed: <!DOCTYPE html>`, the frontend is receiving a web page instead of an image from the API.

This version includes both `/api/generate` and `/api/generator`, health checks, safer API imports, and clearer frontend errors.

After deploying, open: `https://YOUR-VERCEL-DOMAIN/api/generate`

It must show: `iCOOL generate API is working`

If it does not, the API files were not uploaded in the root project folder.


## v5 fix for FUNCTION_PAYLOAD_TOO_LARGE

Vercel Functions have a request/response payload limit. Large iPhone photos can exceed it before the API route starts.

This version fixes it by:
- compressing and resizing the image in the browser before upload,
- keeping the uploaded file around 3.2 MB or less,
- returning JPEG instead of PNG to avoid response payload limits,
- using a smaller 768px preview image only for AI slogan generation.

After deployment, the app displays:
- original selected photo size,
- compressed upload size.


## v6 hotfix

- Shows `v6 Payload Safe Mode is active`.
- Shows `Original` and `Upload to Vercel` sizes.
- Compresses images in the browser to about 1.8 MB.
- Blocks upload if compressed file remains above 2.3 MB.
- Server rejects anything above 2.6 MB.
- If you still see payload error and do not see Original/Upload size box, you are still running an old `app/page.jsx`.
