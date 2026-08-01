"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PhotoSummary {
  id: string;
  status: "pending" | "analyzed" | "failed";
  error: string | null;
  createdAt: string;
  colorHexes: string[];
}

export function UploadManager({ photos }: { photos: PhotoSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose an image first.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/photos", { method: "POST", body: data });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      warning?: string;
    };

    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Upload failed.");
      return;
    }

    form.reset();
    setMessage(
      body.warning
        ? `Uploaded, but analysis failed: ${body.warning}`
        : "Uploaded and analysed.",
    );
    router.refresh();
  }

  async function retry(id: string) {
    setBusy(true);
    await fetch(`/api/photos/${id}`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={upload}>
          {error ? <div className="alert alert--error">{error}</div> : null}
          {message ? <div className="alert">{message}</div> : null}

          <label htmlFor="file">Outfit photo</label>
          <input
            id="file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? "Analysing…" : "Upload and analyse"}
          </button>
          <p className="muted" style={{ marginBottom: 0 }}>
            JPEG, PNG, or WebP up to 8MB. Analysis takes a few seconds.
          </p>
        </form>
      </div>

      <h2>Your uploads ({photos.length})</h2>
      {photos.length === 0 ? (
        <p className="muted">Nothing uploaded yet.</p>
      ) : (
        <ul className="photo-grid">
          {photos.map((photo) => (
            <li key={photo.id}>
              {/* Served through an authenticated route, not a public URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${photo.id}/image`} alt="Uploaded outfit" />
              {photo.colorHexes.length > 0 ? (
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  {photo.colorHexes.map((hex, index) => (
                    <span
                      key={`${hex}-${index}`}
                      aria-hidden="true"
                      style={{
                        background: hex,
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                      }}
                    />
                  ))}
                </div>
              ) : null}
              <div className="status">
                <span>
                  {photo.status === "analyzed"
                    ? "Analysed"
                    : photo.status === "failed"
                      ? "Failed"
                      : "Pending"}
                </span>
                <span style={{ display: "flex", gap: 8 }}>
                  {photo.status !== "analyzed" ? (
                    <button
                      className="linkish"
                      onClick={() => retry(photo.id)}
                      disabled={busy}
                    >
                      Retry
                    </button>
                  ) : null}
                  <button
                    className="linkish"
                    onClick={() => remove(photo.id)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </span>
              </div>
              {photo.error ? (
                <div className="muted" style={{ fontSize: "0.75rem" }}>
                  {photo.error}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
