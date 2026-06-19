"use client";

import { useEffect, useMemo, useState } from "react";

const defaultSettings = {
  industry: "auto",
  cleanup: "medium",
  logoScale: "100",
  footerScale: "100",
  customSlogan: "",
};

const MAX_UPLOAD_BYTES = 3.2 * 1024 * 1024;
const MAX_UPLOAD_SIDE = 1800;

function formatMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function compressImageForVercel(file) {
  if (!file.type.startsWith("image/")) return file;

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.82;
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

    while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.54) {
      quality -= 0.08;
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    }

    if (!blob) return file;

    return new File([blob], "icool-upload.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function Page() {
  const [file, setFile] = useState(null);
  const [originalSize, setOriginalSize] = useState("");
  const [uploadSize, setUploadSize] = useState("");
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("icoolPhotoSettings");
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  function updateSetting(key, value) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem("icoolPhotoSettings", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const canGenerate = useMemo(() => !!file && !loading, [file, loading]);

  async function onFileChange(e) {
    const selected = e.target.files?.[0];

    setResult("");
    setUploadSize("");
    setOriginalSize(selected ? formatMB(selected.size) : "");

    if (preview) URL.revokeObjectURL(preview);

    if (!selected) {
      setFile(null);
      setPreview("");
      return;
    }

    setPreview(URL.createObjectURL(selected));

    try {
      const compressed = await compressImageForVercel(selected);
      setFile(compressed);
      setUploadSize(formatMB(compressed.size));
    } catch (err) {
      alert("Image compression failed: " + err.message);
      setFile(selected);
      setUploadSize(formatMB(selected.size));
    }
  }

  async function callGenerate(apiPath, form) {
    const res = await fetch(apiPath, { method: "POST", body: form });
    const type = res.headers.get("content-type") || "";

    if (res.ok && type.includes("image/")) {
      return await res.blob();
    }

    const text = await res.text();

    if (res.status === 413 || text.includes("FUNCTION_PAYLOAD_TOO_LARGE")) {
      throw new Error("الصورة ما زالت كبيرة على Vercel. اختر صورة أصغر أو خففها أكثر قبل الرفع.");
    }

    if (text.trim().startsWith("<!DOCTYPE") || text.includes("<html")) {
      throw new Error(
        `API route ${apiPath} returned HTML. تأكد أن app/api/generate/route.js موجود في root المشروع.`
      );
    }

    throw new Error(text || `API failed at ${apiPath}`);
  }

  async function generate() {
    if (!file) return;
    setLoading(true);
    setResult("");

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("industry", settings.industry);
      form.append("cleanup", settings.cleanup);
      form.append("logoScale", settings.logoScale);
      form.append("footerScale", settings.footerScale);
      form.append("customSlogan", settings.customSlogan);

      let blob;
      try {
        blob = await callGenerate("/api/generate", form);
      } catch (firstError) {
        console.warn(firstError);
        blob = await callGenerate("/api/generator", form);
      }

      setResult(URL.createObjectURL(blob));
    } catch (err) {
      alert("Generation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function shareImage() {
    if (!result) return;
    const blob = await fetch(result).then((r) => r.blob());
    const shareFile = new File([blob], "icool-branded-photo.jpg", { type: "image/jpeg" });

    if (navigator.canShare?.({ files: [shareFile] })) {
      await navigator.share({ files: [shareFile], title: "iCOOL Photo" });
    } else {
      window.open(result, "_blank");
    }
  }

  return (
    <main>
      <button
        type="button"
        className="settingsFab"
        aria-label="Open settings"
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSettingsOpen(true);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSettingsOpen(true);
        }}
      >
        ⚙️
      </button>

      {settingsOpen && (
        <div
          className="settingsModal"
          onPointerUp={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <div className="settingsPanel">
            <div className="settingsHeader">
              <h2>Photo Settings</h2>
              <button
                type="button"
                className="closeBtn"
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSettingsOpen(false);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSettingsOpen(false);
                }}
              >
                ×
              </button>
            </div>

            <label>Project type</label>
            <select value={settings.industry} onChange={(e) => updateSetting("industry", e.target.value)}>
              <option value="auto">Auto detect</option>
              <option value="hvac">HVAC</option>
              <option value="solar">Solar</option>
              <option value="mep">MEP / Electrical</option>
              <option value="lighting">Lighting</option>
              <option value="inventory">Inventory / Stock</option>
              <option value="finishing">Finishing / Plumbing</option>
              <option value="team">Team / People</option>
            </select>

            <label>Cleanup strength</label>
            <select value={settings.cleanup} onChange={(e) => updateSetting("cleanup", e.target.value)}>
              <option value="light">Light - very natural</option>
              <option value="medium">Medium - recommended</option>
              <option value="strong">Strong - cleaner commercial look</option>
            </select>

            <label>Logo scale</label>
            <select value={settings.logoScale} onChange={(e) => updateSetting("logoScale", e.target.value)}>
              <option value="85">Small</option>
              <option value="100">Normal</option>
              <option value="115">Large</option>
            </select>

            <label>Footer scale</label>
            <select value={settings.footerScale} onChange={(e) => updateSetting("footerScale", e.target.value)}>
              <option value="90">Slim</option>
              <option value="100">Normal</option>
              <option value="115">Large</option>
            </select>

            <label>Optional slogan override</label>
            <input
              type="text"
              placeholder="Leave empty for smart slogan"
              value={settings.customSlogan}
              onChange={(e) => updateSetting("customSlogan", e.target.value)}
            />

            <button
              type="button"
              className="secondaryBtn"
              onPointerUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSettings(defaultSettings);
                localStorage.removeItem("icoolPhotoSettings");
              }}
            >
              Reset Settings
            </button>
          </div>
        </div>
      )}

      <section className="hero">
        <div>
          <img className="logo" src="/icool-logo.png" alt="iCOOL" />
          <h1>iCOOL Photo Branding App</h1>
          <p>
            Upload a real project photo. The app improves clarity and lighting,
            protects the original scene and faces, adds the exact iCOOL logo,
            adds the footer, and creates a professional slogan.
          </p>
        </div>

        <div className="card note">
          Current settings: {settings.industry.toUpperCase()} / {settings.cleanup} cleanup.
          Tap ⚙️ to change parameters. Large phone photos are compressed before upload to avoid Vercel payload limits.
        </div>
      </section>

      <section className="grid">
        <div className="card controlCard">
          <label>Upload photo</label>
          <input type="file" accept="image/*" onChange={onFileChange} />

          {(originalSize || uploadSize) && (
            <p className="sizeInfo">
              Original: {originalSize || "-"}<br />
              Upload to Vercel: {uploadSize || "Preparing..."}
            </p>
          )}

          <button type="button" disabled={!canGenerate} onClick={generate}>
            {loading ? "Processing..." : "Generate Branded Photo"}
          </button>

          <button type="button" className="secondaryBtn" onClick={() => setSettingsOpen(true)}>
            Open Settings
          </button>
        </div>

        <div className="card">
          <div className="previewBox">
            {result ? (
              <img src={result} alt="Result" />
            ) : preview ? (
              <img src={preview} alt="Preview" />
            ) : (
              <p>Choose a photo to preview the result here.</p>
            )}
          </div>

          {result && (
            <div className="resultActions">
              <a href={result} download="icool-branded-photo.jpg">Download</a>
              <button type="button" onClick={shareImage}>Share</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
