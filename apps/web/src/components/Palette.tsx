import type { ColorBlend, PaletteEntry } from "@dressptl/shared";

export function Swatches({ palette }: { palette: PaletteEntry[] }) {
  if (palette.length === 0) {
    return <p className="muted">No colours learned yet.</p>;
  }

  return (
    <ul className="swatches">
      {palette.map((entry) => (
        <li className="swatch" key={entry.name}>
          <div
            className="swatch__chip"
            style={{ background: entry.hex }}
            /* Colour is decorative here; the name below carries the meaning. */
            aria-hidden="true"
          />
          <div className="swatch__name">{entry.name}</div>
          <div className="muted">{(entry.share * 100).toFixed(0)}% of wardrobe</div>
        </li>
      ))}
    </ul>
  );
}

export function Blends({ blends }: { blends: ColorBlend[] }) {
  if (blends.length === 0) {
    return (
      <p className="muted">
        Upload a few more outfits and your favourite pairings will show up here.
      </p>
    );
  }

  return (
    <div>
      {blends.map((blend) => (
        <div className="blend" key={blend.names.join("+")}>
          <div className="blend__pair" aria-hidden="true">
            <span style={{ background: blend.hexes[0] }} />
            <span style={{ background: blend.hexes[1] }} />
          </div>
          <div>
            <strong>
              {blend.names[0]} + {blend.names[1]}
            </strong>
            <div className="muted">
              {blend.harmony.replace("-", " ")} · {(blend.share * 100).toFixed(0)}%
              of your pairings
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
