import type { Undertone } from "./color";

export type Category =
  | "top"
  | "bottom"
  | "outerwear"
  | "shoes"
  | "jewelry"
  | "watch"
  | "socks"
  | "hair";

export type Intensity = "soft" | "medium" | "bold";
export type Metal = "gold" | "silver" | "rose-gold";

export interface CatalogItem {
  id: string;
  name: string;
  line: string;
  category: Category;
  colorHex: string;
  colorName: string;
  undertones: Undertone[];
  intensities: Intensity[];
  metal?: Metal;
  description: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Top",
  bottom: "Bottom",
  outerwear: "Outerwear",
  shoes: "Shoes",
  jewelry: "Jewelry",
  watch: "Watch",
  socks: "Socks",
  hair: "Hair Color",
};

export const CATALOG: CatalogItem[] = [
  // ---- Tops ----
  { id: "top-01", name: "Camel Silk Blouse", line: "Meridian Studio", category: "top", colorHex: "#C19A6B", colorName: "Camel", undertones: ["warm", "neutral"], intensities: ["soft", "medium"], description: "A soft-draping silk blouse in warm camel." },
  { id: "top-02", name: "Coral Linen Shirt", line: "Palette Label", category: "top", colorHex: "#FF7F50", colorName: "Coral", undertones: ["warm"], intensities: ["medium", "bold"], description: "Breezy linen shirt in a vivid warm coral." },
  { id: "top-03", name: "Ice Blue Poplin Shirt", line: "Norlan & Fitch", category: "top", colorHex: "#AFDBF5", colorName: "Ice Blue", undertones: ["cool"], intensities: ["soft", "medium"], description: "Crisp poplin shirt in a cool, pale blue." },
  { id: "top-04", name: "Berry Wrap Top", line: "Voss Atelier", category: "top", colorHex: "#8E3B57", colorName: "Berry", undertones: ["cool"], intensities: ["medium", "bold"], description: "Fitted wrap top in a jewel-toned berry." },
  { id: "top-05", name: "Ivory Knit Sweater", line: "Stonebridge Co.", category: "top", colorHex: "#F4EDE4", colorName: "Ivory", undertones: ["warm", "neutral"], intensities: ["soft"], description: "Chunky-knit sweater in a warm ivory." },
  { id: "top-06", name: "Slate Grey Henley", line: "Norlan & Fitch", category: "top", colorHex: "#6E7783", colorName: "Slate Grey", undertones: ["cool", "neutral"], intensities: ["medium"], description: "Everyday henley in a cool slate grey." },
  { id: "top-07", name: "Olive Utility Shirt", line: "Stonebridge Co.", category: "top", colorHex: "#6B7A3A", colorName: "Olive", undertones: ["warm", "neutral"], intensities: ["medium", "bold"], description: "Structured utility shirt in earthy olive." },
  { id: "top-08", name: "Emerald Silk Cami", line: "Voss Atelier", category: "top", colorHex: "#0F6B4C", colorName: "Emerald", undertones: ["cool", "neutral"], intensities: ["bold"], description: "Statement silk camisole in emerald." },

  // ---- Bottoms ----
  { id: "bottom-01", name: "Rust Wide-Leg Trousers", line: "Meridian Studio", category: "bottom", colorHex: "#B7410E", colorName: "Rust", undertones: ["warm"], intensities: ["medium", "bold"], description: "High-waisted wide-leg trousers in rust." },
  { id: "bottom-02", name: "Charcoal Tailored Trousers", line: "Stonebridge Co.", category: "bottom", colorHex: "#36454F", colorName: "Charcoal", undertones: ["cool", "neutral"], intensities: ["medium", "bold"], description: "Sharp tailored trousers in charcoal." },
  { id: "bottom-03", name: "Sand Chino", line: "Norlan & Fitch", category: "bottom", colorHex: "#D9C29C", colorName: "Sand", undertones: ["warm", "neutral"], intensities: ["soft", "medium"], description: "Classic chino in a warm sand tone." },
  { id: "bottom-04", name: "Navy Straight-Leg Jeans", line: "Palette Label", category: "bottom", colorHex: "#1B2A4A", colorName: "Navy", undertones: ["cool", "neutral"], intensities: ["bold"], description: "Dark-wash denim in true navy." },
  { id: "bottom-05", name: "Plum Midi Skirt", line: "Voss Atelier", category: "bottom", colorHex: "#673147", colorName: "Plum", undertones: ["cool"], intensities: ["medium", "bold"], description: "A-line midi skirt in deep plum." },
  { id: "bottom-06", name: "Honey Corduroy Pants", line: "Meridian Studio", category: "bottom", colorHex: "#C68E17", colorName: "Honey", undertones: ["warm"], intensities: ["medium"], description: "Soft-wale corduroy in golden honey." },

  // ---- Outerwear ----
  { id: "outer-01", name: "Camel Wool Coat", line: "Stonebridge Co.", category: "outerwear", colorHex: "#B08D57", colorName: "Camel", undertones: ["warm", "neutral"], intensities: ["medium"], description: "Timeless wool coat in warm camel." },
  { id: "outer-02", name: "Charcoal Peacoat", line: "Norlan & Fitch", category: "outerwear", colorHex: "#3C3F41", colorName: "Charcoal", undertones: ["cool", "neutral"], intensities: ["bold"], description: "Double-breasted peacoat in charcoal." },
  { id: "outer-03", name: "Burgundy Trench", line: "Voss Atelier", category: "outerwear", colorHex: "#6D1B2A", colorName: "Burgundy", undertones: ["cool", "warm"], intensities: ["bold"], description: "Belted trench in rich burgundy." },
  { id: "outer-04", name: "Sage Field Jacket", line: "Meridian Studio", category: "outerwear", colorHex: "#8A9A5B", colorName: "Sage", undertones: ["warm", "neutral"], intensities: ["soft", "medium"], description: "Lightweight field jacket in muted sage." },
  { id: "outer-05", name: "Pale Blush Blazer", line: "Palette Label", category: "outerwear", colorHex: "#EAC7C0", colorName: "Pale Blush", undertones: ["cool", "neutral"], intensities: ["soft"], description: "Softly tailored blazer in pale blush." },

  // ---- Shoes ----
  { id: "shoe-01", name: "Cognac Leather Loafers", line: "Stonebridge Co.", category: "shoes", colorHex: "#8A3B12", colorName: "Cognac", undertones: ["warm"], intensities: ["medium"], description: "Hand-finished loafers in cognac leather." },
  { id: "shoe-02", name: "Black Patent Oxfords", line: "Norlan & Fitch", category: "shoes", colorHex: "#0B0B0B", colorName: "Black", undertones: ["cool", "neutral"], intensities: ["bold"], description: "Polished patent-leather oxfords." },
  { id: "shoe-03", name: "Taupe Suede Flats", line: "Palette Label", category: "shoes", colorHex: "#B4A090", colorName: "Taupe", undertones: ["warm", "neutral"], intensities: ["soft"], description: "Everyday flats in soft suede taupe." },
  { id: "shoe-04", name: "Wine Ankle Boots", line: "Voss Atelier", category: "shoes", colorHex: "#5E1F2E", colorName: "Wine", undertones: ["cool"], intensities: ["bold"], description: "Sleek ankle boots in deep wine." },
  { id: "shoe-05", name: "Ivory Canvas Sneakers", line: "Meridian Studio", category: "shoes", colorHex: "#F1E9DA", colorName: "Ivory", undertones: ["warm", "neutral", "cool"], intensities: ["soft"], description: "Minimal canvas sneakers in ivory." },
  { id: "shoe-06", name: "Forest Green Chelsea Boots", line: "Stonebridge Co.", category: "shoes", colorHex: "#1F3D2B", colorName: "Forest Green", undertones: ["cool", "neutral"], intensities: ["bold"], description: "Chelsea boots in deep forest green." },

  // ---- Jewelry ----
  { id: "jewel-01", name: "Gold Chain Necklace", line: "Aurelio Row", category: "jewelry", colorHex: "#D4AF37", colorName: "Gold", undertones: ["warm"], intensities: ["medium", "bold"], metal: "gold", description: "Classic flat-link chain in 18k-look gold." },
  { id: "jewel-02", name: "Silver Pendant Necklace", line: "Aurelio Row", category: "jewelry", colorHex: "#C0C0C0", colorName: "Silver", undertones: ["cool"], intensities: ["soft", "medium"], metal: "silver", description: "Delicate pendant on a fine silver chain." },
  { id: "jewel-03", name: "Rose Gold Hoop Earrings", line: "Aurelio Row", category: "jewelry", colorHex: "#B76E79", colorName: "Rose Gold", undertones: ["warm", "neutral"], intensities: ["soft", "medium"], metal: "rose-gold", description: "Lightweight hoops in warm rose gold." },
  { id: "jewel-04", name: "Gold Statement Cuff", line: "Aurelio Row", category: "jewelry", colorHex: "#CFA130", colorName: "Gold", undertones: ["warm"], intensities: ["bold"], metal: "gold", description: "Wide sculptural cuff in brushed gold." },
  { id: "jewel-05", name: "Silver Bar Bracelet", line: "Aurelio Row", category: "jewelry", colorHex: "#B8C0C4", colorName: "Silver", undertones: ["cool", "neutral"], intensities: ["soft"], metal: "silver", description: "Minimal bar bracelet in polished silver." },
  { id: "jewel-06", name: "Pearl Drop Earrings", line: "Aurelio Row", category: "jewelry", colorHex: "#F0EAD6", colorName: "Pearl", undertones: ["cool", "neutral", "warm"], intensities: ["soft"], metal: "silver", description: "Freshwater pearl drops on silver posts." },

  // ---- Watches ----
  { id: "watch-01", name: "Gold-Tone Dress Watch", line: "Aurelio Row", category: "watch", colorHex: "#C9A227", colorName: "Gold", undertones: ["warm"], intensities: ["medium", "bold"], metal: "gold", description: "Slim dress watch with a gold-tone case." },
  { id: "watch-02", name: "Silver Steel Watch", line: "Aurelio Row", category: "watch", colorHex: "#A9B1B7", colorName: "Silver", undertones: ["cool", "neutral"], intensities: ["medium"], metal: "silver", description: "Brushed stainless steel case and bracelet." },
  { id: "watch-03", name: "Rose Gold Mesh Watch", line: "Aurelio Row", category: "watch", colorHex: "#B76E79", colorName: "Rose Gold", undertones: ["warm", "neutral"], intensities: ["soft", "medium"], metal: "rose-gold", description: "Rose gold case on a fine mesh strap." },
  { id: "watch-04", name: "Black Leather Chrono", line: "Aurelio Row", category: "watch", colorHex: "#1A1A1A", colorName: "Black", undertones: ["cool", "neutral"], intensities: ["bold"], metal: "silver", description: "Chronograph on a black leather strap." },

  // ---- Socks ----
  { id: "sock-01", name: "Burnt Orange Ribbed Socks", line: "Palette Label", category: "socks", colorHex: "#CC5500", colorName: "Burnt Orange", undertones: ["warm"], intensities: ["medium", "bold"], description: "Ribbed cotton socks in burnt orange." },
  { id: "sock-02", name: "Steel Blue Socks", line: "Palette Label", category: "socks", colorHex: "#4A6D8C", colorName: "Steel Blue", undertones: ["cool"], intensities: ["medium"], description: "Fine-knit socks in cool steel blue." },
  { id: "sock-03", name: "Oatmeal Socks", line: "Palette Label", category: "socks", colorHex: "#D8CBB8", colorName: "Oatmeal", undertones: ["warm", "neutral"], intensities: ["soft"], description: "Everyday socks in soft warm oatmeal." },
  { id: "sock-04", name: "Charcoal Socks", line: "Palette Label", category: "socks", colorHex: "#3F4448", colorName: "Charcoal", undertones: ["cool", "neutral"], intensities: ["bold"], description: "Classic ribbed socks in charcoal." },
  { id: "sock-05", name: "Cherry Red Socks", line: "Palette Label", category: "socks", colorHex: "#9B2335", colorName: "Cherry Red", undertones: ["cool", "warm"], intensities: ["bold"], description: "A bright pop of cherry red." },

  // ---- Hair color / styling ----
  { id: "hair-01", name: "Honey Balayage", line: "Studio Aurelio Hair", category: "hair", colorHex: "#B8752E", colorName: "Honey", undertones: ["warm"], intensities: ["medium"], description: "Golden honey balayage over a warm base." },
  { id: "hair-02", name: "Ash Brunette", line: "Studio Aurelio Hair", category: "hair", colorHex: "#4A3F3B", colorName: "Ash Brown", undertones: ["cool"], intensities: ["medium", "bold"], description: "Cool-toned ash brown, no brassiness." },
  { id: "hair-03", name: "Copper Red", line: "Studio Aurelio Hair", category: "hair", colorHex: "#B5502D", colorName: "Copper", undertones: ["warm"], intensities: ["bold"], description: "Vivid copper red for warm undertones." },
  { id: "hair-04", name: "Platinum Blonde", line: "Studio Aurelio Hair", category: "hair", colorHex: "#E8E4D9", colorName: "Platinum", undertones: ["cool"], intensities: ["bold"], description: "Icy platinum blonde, cool cast." },
  { id: "hair-05", name: "Espresso Brunette", line: "Studio Aurelio Hair", category: "hair", colorHex: "#2E2321", colorName: "Espresso", undertones: ["cool", "neutral"], intensities: ["bold"], description: "Deep, near-black espresso brown." },
  { id: "hair-06", name: "Golden Blonde", line: "Studio Aurelio Hair", category: "hair", colorHex: "#D9A441", colorName: "Golden Blonde", undertones: ["warm"], intensities: ["soft", "medium"], description: "Warm golden blonde with honey highlights." },
  { id: "hair-07", name: "Caramel Balayage", line: "Studio Aurelio Hair", category: "hair", colorHex: "#9C6B30", colorName: "Caramel", undertones: ["warm", "neutral"], intensities: ["soft", "medium"], description: "Soft caramel tones for a natural warm lift." },
];
