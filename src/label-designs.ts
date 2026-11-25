/**
 * Image-rendered label designs: text-only labels (no QR) and jar labels for
 * jam and syrup with line art. Rendered at the printer's native resolution,
 * strictly black and white for thermal printers.
 */
import type { FreezerItem } from "./types";
import { formatDate } from "./localize";
import type { LocalizeFunc } from "./localize";

export interface LabelOptions {
  /** Printer resolution: 203 (default) or 300 (e.g. Niimbot B1 Pro). */
  dpi: number;
  /** Print a QR code on freezer labels. */
  qr: boolean;
  /** Card language, used for month names. */
  language: string;
}

export const DEFAULT_LABEL_OPTIONS: LabelOptions = {
  dpi: 203,
  qr: true,
  language: "en",
};

export function pxPerMm(dpi: number): number {
  return dpi === 300 ? 300 / 25.4 : 8;
}

/** Label size in device pixels, clamped to the 2" printhead (B1 / B1 Pro). */
export function labelPixels(
  widthMm: number,
  heightMm: number,
  dpi: number
): { width: number; height: number } {
  const ppmm = pxPerMm(dpi);
  return {
    width: Math.min(Math.round(widthMm * ppmm), dpi === 300 ? 567 : 384),
    height: Math.round(heightMm * ppmm),
  };
}

type JarKind = "jam" | "syrup";

/** Jar design is chosen by the category (id or name). */
export function jarKind(
  item: Pick<FreezerItem, "category_id" | "category_name">
): JarKind | null {
  const text = `${item.category_id ?? ""} ${item.category_name ?? ""}`.toLowerCase();
  if (/sirup|syrup/.test(text)) return "syrup";
  if (/marmelade|konfit|\bjam\b/.test(text)) return "jam";
  return null;
}

type Ctx = CanvasRenderingContext2D;
type P = [number, number];
type Curve = [P, P, P];

/** Line art in a unit square placed at (x, y) with edge length s. */
function drawIcon(
  ctx: Ctx,
  name: string,
  kind: JarKind,
  x: number,
  y: number,
  s: number,
  line: number
): void {
  const at = ([a, b]: P): P => [x + a * s, y + b * s];
  const path = (curves: Curve[], w = line) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    for (const [from, control, to] of curves) {
      ctx.moveTo(...at(from));
      ctx.quadraticCurveTo(...at(control), ...at(to));
    }
    ctx.stroke();
  };
  const circle = (c: P, r: number, fill?: string, w = line) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(...at(c), r * s, 0, 2 * Math.PI);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
    ctx.fillStyle = "#000";
  };
  const leaf = (a: P, b: P) => {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dx = (b[0] - a[0]) * 0.45;
    const dy = (b[1] - a[1]) * 0.45;
    path([
      [a, [mx - dy, my + dx], b],
      [a, [mx + dy, my - dx], b],
      [a, a, b],
    ]);
  };

  const key = name.toLowerCase();
  if (/erdbeer|strawberr/.test(key)) {
    path([
      [[0.5, 0.28], [0.02, 0.18], [0.14, 0.55]],
      [[0.14, 0.55], [0.28, 0.88], [0.5, 0.96]],
      [[0.5, 0.96], [0.72, 0.88], [0.86, 0.55]],
      [[0.86, 0.55], [0.98, 0.18], [0.5, 0.28]],
    ]);
    const tips: P[] = [[0.2, 0.2], [0.34, 0.08], [0.7, 0.09], [0.82, 0.22], [0.52, 0.42]];
    tips.forEach((tip) => leaf([0.5, 0.27], tip));
    path([[[0.5, 0.27], [0.47, 0.12], [0.56, 0.02]]]);
    const seeds: P[] = [[0.3, 0.45], [0.5, 0.55], [0.7, 0.45], [0.38, 0.65], [0.62, 0.65], [0.5, 0.78]];
    seeds.forEach((seed) => circle(seed, 0.025, "#000"));
  } else if (/marille|aprikos|apricot/.test(key)) {
    circle([0.48, 0.6], 0.36);
    path([
      [[0.48, 0.25], [0.3, 0.55], [0.46, 0.94]],
      [[0.48, 0.25], [0.48, 0.14], [0.56, 0.05]],
    ]);
    leaf([0.52, 0.18], [0.94, 0.08]);
    path([[[0.66, 0.42], [0.76, 0.52], [0.74, 0.66]]], line / 2);
  } else if (/holunder|elder/.test(key)) {
    const heads: P[] = [[0.22, 0.3], [0.42, 0.18], [0.64, 0.2], [0.8, 0.34], [0.33, 0.42], [0.53, 0.36], [0.68, 0.48], [0.46, 0.54]];
    heads.forEach((h) => path([[[0.5, 0.95], [0.5, 0.68], h]], line / 2));
    for (const [a, b] of heads) {
      for (let k = 0; k < 5; k++) {
        const t = (k * 2 * Math.PI) / 5;
        circle([a + 0.052 * Math.cos(t), b + 0.052 * Math.sin(t)], 0.04, "#fff", line / 2);
      }
      circle([a, b], 0.022, "#000", line / 2);
    }
    leaf([0.5, 0.84], [0.12, 0.7]);
    leaf([0.5, 0.84], [0.88, 0.7]);
  } else if (kind === "syrup") {
    // generic bottle
    ctx.lineWidth = line;
    ctx.strokeRect(x + 0.42 * s, y + 0.04 * s, 0.16 * s, 0.1 * s);
    path([
      [[0.43, 0.14], [0.43, 0.25], [0.43, 0.3]],
      [[0.43, 0.3], [0.27, 0.38], [0.27, 0.5]],
      [[0.27, 0.5], [0.27, 0.72], [0.27, 0.96]],
      [[0.27, 0.96], [0.5, 0.96], [0.73, 0.96]],
      [[0.73, 0.96], [0.73, 0.72], [0.73, 0.5]],
      [[0.73, 0.5], [0.73, 0.38], [0.57, 0.3]],
      [[0.57, 0.3], [0.57, 0.25], [0.57, 0.14]],
    ]);
    ctx.strokeRect(x + 0.34 * s, y + 0.56 * s, 0.32 * s, 0.22 * s);
  } else {
    // generic jar
    ctx.lineWidth = line;
    ctx.strokeRect(x + 0.24 * s, y + 0.1 * s, 0.52 * s, 0.14 * s);
    path([
      [[0.28, 0.24], [0.14, 0.3], [0.14, 0.44]],
      [[0.14, 0.44], [0.14, 0.65], [0.14, 0.84]],
      [[0.14, 0.84], [0.14, 0.95], [0.28, 0.95]],
      [[0.28, 0.95], [0.5, 0.95], [0.72, 0.95]],
      [[0.72, 0.95], [0.86, 0.95], [0.86, 0.84]],
      [[0.86, 0.84], [0.86, 0.65], [0.86, 0.44]],
      [[0.86, 0.44], [0.86, 0.3], [0.72, 0.24]],
    ]);
    ctx.strokeRect(x + 0.28 * s, y + 0.48 * s, 0.44 * s, 0.28 * s);
  }
}

/** Centered line, shrunk until it fits, ellipsized as a last resort. */
function centered(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight = "",
  family = "system-ui, sans-serif"
): void {
  let px = Math.round(size);
  const apply = () => (ctx.font = `${weight} ${px}px ${family}`.trim());
  apply();
  while (ctx.measureText(text).width > maxWidth && px > size * 0.6) {
    px -= 1;
    apply();
  }
  let out = text;
  while (out.length > 1 && ctx.measureText(out === text ? out : `${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(out === text ? out : `${out}…`, x, y);
}

function newCanvas(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return [canvas, ctx];
}

/** Thermal printers know black and white only: remove anti-aliasing grays. */
function threshold(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] + d[i + 1] + d[i + 2] > 450 ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function amountText(item: FreezerItem, l: LocalizeFunc): string {
  const parts: string[] = [];
  if (item.weight != null) parts.push(`${item.weight} ${item.unit || "g"}`);
  if (item.pieces != null) parts.push(`${item.pieces} ${l("pieces_short")}`);
  return parts.join(" · ");
}

/** Freezer label without QR: product, date, amount (and note if it fits). */
export function drawTextCanvas(
  item: FreezerItem,
  l: LocalizeFunc,
  widthMm: number,
  heightMm: number,
  options: LabelOptions
): HTMLCanvasElement {
  const { width, height } = labelPixels(widthMm, heightMm, options.dpi);
  const [canvas, ctx] = newCanvas(width, height);
  const rows: { text: string; size: number; weight: string }[] = [
    { text: item.product_name, size: 0.23, weight: "700" },
    { text: formatDate(item), size: 0.2, weight: "" },
  ];
  const amount = amountText(item, l);
  if (amount) rows.push({ text: amount, size: 0.17, weight: "" });
  if (item.note && heightMm > 20) {
    rows.push({ text: item.note, size: 0.13, weight: "italic" });
  }
  const total = rows.reduce((sum, row) => sum + row.size * 1.3, 0);
  const unit = height * Math.min(1, 0.94 / total);
  let y = (height - total * unit) / 2;
  for (const row of rows) {
    const h = row.size * 1.3 * unit;
    centered(ctx, row.text, width / 2, y + h / 2, width * 0.92, row.size * unit, row.weight);
    y += h;
  }
  return threshold(canvas);
}

/** Jam / syrup label: line art left; category, variety, note and month right. */
export function drawJarCanvas(
  item: FreezerItem,
  l: LocalizeFunc,
  kind: JarKind,
  widthMm: number,
  heightMm: number,
  options: LabelOptions
): HTMLCanvasElement {
  const { width, height } = labelPixels(widthMm, heightMm, options.dpi);
  const [canvas, ctx] = newCanvas(width, height);
  // layout in the approved 50 x 25 mm proportions
  const ux = width / 50;
  const uy = height / 25;
  const u = Math.min(ux, uy);
  const line = 0.35 * u;

  ctx.lineWidth = line;
  const m = 0.8 * u;
  const r = 2.5 * u;
  ctx.beginPath();
  ctx.moveTo(m + r, m);
  ctx.arcTo(width - m, m, width - m, height - m, r);
  ctx.arcTo(width - m, height - m, m, height - m, r);
  ctx.arcTo(m, height - m, m, m, r);
  ctx.arcTo(m, m, width - m, m, r);
  ctx.stroke();

  const icon = Math.min(18 * ux, 18 * uy);
  drawIcon(ctx, item.product_name, kind, 2.5 * ux, (height - icon) / 2, icon, line);

  const locale =
    ({ de: "de-DE", de_at: "de-AT", cs: "cs-CZ" } as Record<string, string>)[
      options.language
    ] ?? "en-GB";
  const date = new Date(item.year, item.month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const cx = 35 * ux;
  const max = 26 * ux;
  const serif = "Georgia, serif";
  centered(ctx, item.category_name ?? "", cx, 5 * uy, max, 2.9 * u, "", serif);
  centered(ctx, item.product_name, cx, 10 * uy, max, 5 * u, "700", serif);
  ctx.lineWidth = line / 2;
  ctx.beginPath();
  ctx.moveTo(25 * ux, 13.8 * uy);
  ctx.lineTo(45 * ux, 13.8 * uy);
  ctx.stroke();
  centered(ctx, item.note || l("jar_homemade"), cx, 16.8 * uy, max, 2.7 * u);
  centered(ctx, date, cx, 20.8 * uy, max, 2.7 * u);
  return threshold(canvas);
}
