"use client";

import { useMemo, useState } from "react";

export default function Page() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [industry, setIndustry] = useState("auto");
  const [cleanup, setCleanup] = useState("medium");
  const [customSlogan, setCustomSlogan] = useState("");

  const canGenerate = useMemo(() => !!file && !loading, [file, loading]);

  function onFileChange(e) {
    const selected = e.target.files?.[0];
    setFile(selected || null);
    setResult("");
    if (selected) setPreview(URL.createObjectURL(selected));
  }

  async function generate() {
    if (!file) return;
    setLoading(true);
    setResult("");

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("industry", industry);
      form.append("cleanup", cleanup);
      form.append("customSlogan", customSlogan);

      const res = await fetch("/api/generate", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
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
    const shareFile = new File([blob], "icool-branded-photo.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [shareFile] })) {
      await navigator.share({ files: [shareFile], title: "iCOOL Photo" });
    } else {
      window.open(result, "_blank");
    }
  }

  return (
    <main>
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
          This app does not regenerate the whole image. It keeps the original photo real
          and applies professional finishing, branding, and slogan creation.
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <label>Upload photo</label>
          <input type="file" accept="image/*" onChange={onFileChange} />

          <label>Project type</label>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
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
          <select value={cleanup} onChange={(e) => setCleanup(e.target.value)}>
            <option value="light">Light - very natural</option>
            <option value="medium">Medium - recommended</option>
            <option value="strong">Strong - cleaner commercial look</option>
          </select>

          <label>Optional slogan override</label>
          <input
            type="text"
            placeholder="Leave empty for smart slogan"
            value={customSlogan}
            onChange={(e) => setCustomSlogan(e.target.value)}
          />

          <button disabled={!canGenerate} onClick={generate}>
            {loading ? "Processing..." : "Generate Branded Photo"}
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
              <a href={result} download="icool-branded-photo.png">Download</a>
              <button onClick={shareImage}>Share</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
