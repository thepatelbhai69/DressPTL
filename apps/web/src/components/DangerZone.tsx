"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DangerZone() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function deleteAccount() {
    setBusy(true);
    await fetch("/api/account", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <h2>Delete account</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Removes your photos from storage and erases every record — profile,
          analyses, and recommendations. This cannot be undone.
        </p>
        {confirming ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="danger" onClick={deleteAccount} disabled={busy}>
              {busy ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              className="secondary"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button className="danger" onClick={() => setConfirming(true)}>
            Delete my account
          </button>
        )}
      </div>
    </>
  );
}
