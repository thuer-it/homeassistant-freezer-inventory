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

  const dot = (c: P, r: number) => circle(c, r, "#000", line / 2);
  /** Dark berry: filled, with a small highlight. */
  const dark = (c: P, r: number) => {
    circle(c, r, "#000", line / 2);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(...at([c[0] - r * 0.35, c[1] - r * 0.35]), r * 0.25 * s, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#000";
  };
  /** Rows of a cluster that narrows towards the bottom. */
  const cluster = (rows: number[], top: number, dx: number, dy: number): P[] =>
    rows.flatMap((count, row) =>
      Array.from(
        { length: count },
        (_, i): P => [0.5 + (i - (count - 1) / 2) * dx, top + row * dy]
      )
    );
  /** Lobed vine leaf around centre c. */
  const vineLeaf = (c: P, r: number) => {
    const pts: P[] = [[0, 1], [-0.9, 0.55], [-0.55, 0.15], [-1, -0.45], [-0.35, -0.4], [0, -1], [0.35, -0.4], [1, -0.45], [0.55, 0.15], [0.9, 0.55], [0, 1]].map(
      ([a, b]): P => [c[0] + a * r, c[1] + b * r]
    );
    path(pts.slice(1).map((to, i): Curve => [pts[i], pts[i], to]), line / 2);
    path([[c, c, [c[0], c[1] - r * 0.7]], [c, c, [c[0], c[1] + r]]], line / 2);
  };

  const key = name.toLowerCase();
  if (/himbeer|raspberr/.test(key)) {
    // thimble shape: overlapping drupelets, upper rows on top of lower ones
    const rows: [number, number[]][] = [
      [0.88, [0.43, 0.57]],
      [0.76, [0.35, 0.5, 0.65]],
      [0.63, [0.28, 0.43, 0.58, 0.72]],
      [0.5, [0.24, 0.37, 0.5, 0.63, 0.76]],
      [0.37, [0.31, 0.44, 0.57, 0.69]],
    ];
    for (const [py, xs] of rows) {
      for (const px of xs) {
        circle([px, py], 0.09, "#fff", line * 0.7);
        ctx.lineWidth = line * 0.6;
        ctx.beginPath();
        ctx.arc(...at([px, py]), 0.05 * s, 0.1 * Math.PI, 0.7 * Math.PI);
        ctx.stroke();
      }
    }
    // one closed, star shaped calyx on top, short stem
    const star: Curve[] = [
      [[0.44, 0.17], [0.28, 0.13], [0.12, 0.2]],
      [[0.12, 0.2], [0.26, 0.24], [0.36, 0.26]],
      [[0.36, 0.26], [0.3, 0.33], [0.26, 0.43]],
      [[0.26, 0.43], [0.4, 0.37], [0.46, 0.3]],
      [[0.46, 0.3], [0.48, 0.38], [0.53, 0.46]],
      [[0.53, 0.46], [0.57, 0.36], [0.57, 0.29]],
      [[0.57, 0.29], [0.66, 0.36], [0.78, 0.41]],
      [[0.78, 0.41], [0.72, 0.3], [0.65, 0.25]],
      [[0.65, 0.25], [0.78, 0.24], [0.9, 0.17]],
      [[0.9, 0.17], [0.72, 0.12], [0.56, 0.17]],
    ];
    ctx.beginPath();
    ctx.moveTo(...at(star[0][0]));
    for (const [, control, to] of star) ctx.quadraticCurveTo(...at(control), ...at(to));
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = line * 0.8;
    ctx.stroke();
    ctx.fillStyle = "#000";
    path([[[0.5, 0.17], [0.48, 0.06], [0.58, 0.01]]]);
  } else if (/brombeer|blackberr/.test(key)) {
    // long, dense berry: black drupelets separated by white gaps
    const rows: [number, number[]][] = [
      [0.92, [0.5]],
      [0.82, [0.42, 0.58]],
      [0.71, [0.35, 0.5, 0.65]],
      [0.6, [0.28, 0.43, 0.57, 0.72]],
      [0.49, [0.35, 0.5, 0.65]],
      [0.38, [0.28, 0.43, 0.57, 0.72]],
      [0.28, [0.38, 0.5, 0.62]],
    ];
    for (const [py, xs] of rows) {
      for (const px of xs) {
        ctx.beginPath();
        ctx.arc(...at([px, py]), 0.088 * s, 0, 2 * Math.PI);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.fillStyle = "#000";
        dark([px, py], 0.069);
      }
    }
    path([[[0.5, 0.22], [0.48, 0.1], [0.4, 0.03]]]);
    leaf([0.5, 0.2], [0.14, 0.14]);
    leaf([0.5, 0.2], [0.88, 0.1]);
  } else if (/ribisel|johannisbeer|currant/.test(key)) {
    path([[[0.5, 0.02], [0.72, 0.4], [0.55, 0.9]]]);
    const berries: [P, P][] = [
      [[0.58, 0.18], [0.82, 0.32]],
      [[0.6, 0.28], [0.37, 0.4]],
      [[0.64, 0.45], [0.84, 0.57]],
      [[0.63, 0.52], [0.43, 0.63]],
      [[0.61, 0.66], [0.76, 0.8]],
      [[0.55, 0.9], [0.52, 0.89]],
    ];
    for (const [from, to] of berries) {
      path([[from, from, to]], line / 2);
      circle(to, 0.095, "#fff");
      dot([to[0], to[1] + 0.065], 0.014);
    }
    leaf([0.52, 0.06], [0.1, 0.22]);
  } else if (/uhudler/.test(key)) {
    cluster([4, 3, 3, 2, 1], 0.4, 0.16, 0.13).forEach((c) => dark(c, 0.082));
    path([[[0.5, 0.34], [0.5, 0.16], [0.56, 0.04]]]);
    vineLeaf([0.25, 0.15], 0.145);
    path(
      [
        [[0.52, 0.18], [0.74, 0.04], [0.82, 0.18]],
        [[0.82, 0.18], [0.86, 0.3], [0.74, 0.26]],
        [[0.74, 0.26], [0.69, 0.18], [0.78, 0.16]],
      ],
      line / 2
    );
  } else if (/traube|grape/.test(key)) {
    cluster([4, 3, 3, 2, 1], 0.4, 0.16, 0.13).forEach((c) => circle(c, 0.085, "#fff"));
    path([[[0.5, 0.34], [0.5, 0.16], [0.44, 0.04]]]);
    vineLeaf([0.74, 0.15], 0.145);
    path([[[0.5, 0.22], [0.54, 0.2], [0.6, 0.2]]]);
  } else if (/josta/.test(key)) {
    const berries: P[] = [[0.29, 0.58], [0.71, 0.56], [0.5, 0.77]];
    berries.forEach((c) => path([[[0.5, 0.14], [0.5, 0.35], c]], line / 2));
    for (const [a, b] of berries) {
      dark([a, b], 0.18);
      path([
        [[a - 0.04, b + 0.17], [a - 0.04, b + 0.2], [a - 0.07, b + 0.23]],
        [[a, b + 0.18], [a, b + 0.2], [a, b + 0.23]],
        [[a + 0.04, b + 0.17], [a + 0.04, b + 0.2], [a + 0.07, b + 0.23]],
      ], line / 2);
    }
    leaf([0.5, 0.16], [0.12, 0.2]);
    leaf([0.5, 0.16], [0.88, 0.14]);
  } else if (/kriecherl/.test(key)) {
    const plum = (cx: number, cy: number) => {
      ctx.lineWidth = line;
      ctx.beginPath();
      ctx.ellipse(...at([cx, cy]), 0.2 * s, 0.235 * s, 0, 0, 2 * Math.PI);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#000";
      path([[[cx, cy - 0.23], [cx - 0.11, cy], [cx, cy + 0.23]]], line / 2);
      path([[[cx, cy - 0.23], [cx, cy - 0.4], [0.52, 0.14]]]);
    };
    plum(0.29, 0.65);
    plum(0.72, 0.7);
    path([[[0.52, 0.14], [0.53, 0.08], [0.58, 0.03]]]);
    leaf([0.52, 0.14], [0.94, 0.2]);
    leaf([0.52, 0.14], [0.12, 0.12]);
  } else if (/erdbeer|strawberr/.test(key)) {
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
  } else if (/hol+under|elder/.test(key)) {
    // flat umbel: branching stalks carrying a dome of five-petal blossoms
    const forks: [P, P[]][] = [
      [[0.24, 0.52], [[0.12, 0.36], [0.28, 0.32], [0.18, 0.2]]],
      [[0.5, 0.48], [[0.4, 0.14], [0.5, 0.31], [0.61, 0.13]]],
      [[0.76, 0.52], [[0.88, 0.36], [0.72, 0.32], [0.82, 0.2]]],
    ];
    path([[[0.5, 0.99], [0.52, 0.85], [0.5, 0.74]]], line);
    for (const [fork, heads] of forks) {
      path([[[0.5, 0.74], [fork[0], 0.68], fork]], line * 0.7);
      heads.forEach((h) => path([[fork, fork, h]], line / 2));
    }
    for (const [, heads] of forks) {
      for (const [a, b] of heads) {
        for (let k = 0; k < 5; k++) {
          const t = (k * 2 * Math.PI) / 5 - Math.PI / 2;
          circle([a + 0.056 * Math.cos(t), b + 0.056 * Math.sin(t)], 0.045, "#fff", line * 0.55);
        }
        circle([a, b], 0.024, "#000", line / 2);
      }
    }
    leaf([0.5, 0.86], [0.14, 0.72]);
    leaf([0.5, 0.86], [0.86, 0.72]);
  } else if (/dirndl|kornel/.test(key)) {
    // cornelian cherries: long dark drupes below a leaf with curved veins
    const fruit = (cx: number, cy: number, tilt: number) => {
      path([[[0.5, 0.36], [cx, 0.42], [cx, cy - 0.17]]], line / 2);
      ctx.beginPath();
      ctx.ellipse(...at([cx, cy]), 0.11 * s, 0.18 * s, tilt, 0, 2 * Math.PI);
      ctx.fill();
      path([[[cx - 0.06, cy - 0.03], [cx - 0.06, cy - 0.1], [cx - 0.02, cy - 0.12]]], line / 2);
      ctx.strokeStyle = "#fff";
      path([[[cx - 0.06, cy - 0.03], [cx - 0.065, cy - 0.1], [cx - 0.02, cy - 0.13]]], line);
      ctx.strokeStyle = "#000";
    };
    fruit(0.24, 0.66, 0.35);
    fruit(0.76, 0.66, -0.35);
    fruit(0.5, 0.76, 0);
    path(
      [
        [[0.5, 0.36], [0.2, 0.19], [0.9, 0.04]],
        [[0.9, 0.04], [0.82, 0.38], [0.5, 0.36]],
        [[0.5, 0.36], [0.68, 0.24], [0.86, 0.07]],
      ],
      line * 0.8
    );
    leaf([0.5, 0.36], [0.1, 0.12]);
  } else if (/feige/.test(key)) {
    const drop = (cx: number, top: number, w: number, bottom: number) => {
      ctx.beginPath();
      ctx.moveTo(...at([cx, top]));
      ctx.bezierCurveTo(...at([cx + w * 0.3, top + 0.18]), ...at([cx + w, bottom - 0.4]), ...at([cx + w, bottom - 0.22]));
      ctx.bezierCurveTo(...at([cx + w, bottom + 0.06]), ...at([cx - w, bottom + 0.06]), ...at([cx - w, bottom - 0.22]));
      ctx.bezierCurveTo(...at([cx - w, bottom - 0.4]), ...at([cx - w * 0.3, top + 0.18]), ...at([cx, top]));
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.lineWidth = line;
      ctx.stroke();
      ctx.fillStyle = "#000";
    };
    // whole fruit with ribs, in front of it a cut half with seeds
    drop(0.34, 0.12, 0.3, 0.82);
    path(
      [
        [[0.34, 0.14], [0.08, 0.5], [0.2, 0.8]],
        [[0.34, 0.14], [0.26, 0.5], [0.34, 0.82]],
      ],
      line / 2
    );
    path([[[0.34, 0.12], [0.33, 0.06], [0.4, 0.02]]]);
    drop(0.68, 0.32, 0.27, 0.95);
    ctx.lineWidth = line / 2;
    ctx.beginPath();
    ctx.ellipse(...at([0.68, 0.72]), 0.17 * s, 0.17 * s, 0, 0, 2 * Math.PI);
    ctx.stroke();
    const seeds: P[] = [[0.62, 0.64], [0.74, 0.64], [0.57, 0.72], [0.68, 0.71], [0.79, 0.72], [0.62, 0.8], [0.74, 0.8]];
    seeds.forEach((seed) => circle(seed, 0.022, "#000", line / 2));
  } else if (/zwetsch|pflaume/.test(key)) {
    const plum = (cx: number, cy: number, tilt: number) => {
      ctx.beginPath();
      ctx.ellipse(...at([cx, cy]), 0.18 * s, 0.29 * s, tilt, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      path([[[cx + 0.02, cy - 0.27], [cx + 0.1, cy], [cx - 0.02, cy + 0.27]]], line * 0.7);
      path([[[cx - 0.11, cy - 0.02], [cx - 0.11, cy - 0.15], [cx - 0.05, cy - 0.2]]], line);
      ctx.strokeStyle = "#000";
    };
    plum(0.3, 0.66, 0.3);
    plum(0.71, 0.66, -0.3);
    path([
      [[0.38, 0.38], [0.42, 0.22], [0.5, 0.18]],
      [[0.63, 0.38], [0.58, 0.22], [0.5, 0.18]],
      [[0.5, 0.18], [0.49, 0.1], [0.54, 0.04]],
    ]);
    leaf([0.5, 0.18], [0.92, 0.08]);
    leaf([0.5, 0.18], [0.1, 0.1]);
  } else if (/cola|eberraute/.test(key)) {
    // southernwood: upright sprigs with fine, feathery leaves
    const sprig = (from: P, to: P) => {
      path([[from, from, to]], line * 0.8);
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      for (let i = 2; i <= 7; i++) {
        const t = i / 8;
        const p: P = [from[0] + dx * t, from[1] + dy * t];
        const len = 0.2 * (1 - t * 0.55);
        for (const side of [-1, 1]) {
          const angle = Math.atan2(dy, dx) + side * 0.75;
          const end: P = [p[0] + len * Math.cos(angle), p[1] + len * Math.sin(angle)];
          path([[p, p, end]], line / 2);
          const mid: P = [(p[0] + end[0]) / 2, (p[1] + end[1]) / 2];
          path([[mid, mid, [mid[0] + len * 0.4 * Math.cos(angle + side * 0.8), mid[1] + len * 0.4 * Math.sin(angle + side * 0.8)]]], line / 2);
        }
      }
      path([[to, to, [to[0] + dx * 0.1, to[1] + dy * 0.1]]], line / 2);
    };
    sprig([0.5, 0.98], [0.5, 0.1]);
    sprig([0.5, 0.98], [0.16, 0.3]);
    sprig([0.5, 0.98], [0.84, 0.3]);
  } else if (/haussaft|haus-saft/.test(key)) {
    // a little house with a heart
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.moveTo(...at([0.04, 0.48]));
    ctx.lineTo(...at([0.5, 0.08]));
    ctx.lineTo(...at([0.96, 0.48]));
    ctx.moveTo(...at([0.15, 0.39]));
    ctx.lineTo(...at([0.15, 0.94]));
    ctx.lineTo(...at([0.85, 0.94]));
    ctx.lineTo(...at([0.85, 0.39]));
    ctx.stroke();
    ctx.strokeRect(...at([0.68, 0.12]), 0.12 * s, 0.17 * s);
    ctx.beginPath();
    ctx.moveTo(...at([0.5, 0.79]));
    ctx.bezierCurveTo(...at([0.2, 0.6]), ...at([0.3, 0.4]), ...at([0.5, 0.53]));
    ctx.bezierCurveTo(...at([0.7, 0.4]), ...at([0.8, 0.6]), ...at([0.5, 0.79]));
    ctx.fill();
  } else if (/spitzweg/.test(key)) {
    // ribwort plantain: lanceolate leaves, bare stalks with short spikes
    const blade = (tip: P, bulge: number) => {
      const base: P = [0.5, 0.97];
      const mx = (base[0] + tip[0]) / 2;
      const my = (base[1] + tip[1]) / 2;
      const nx = (tip[1] - base[1]) * bulge;
      const ny = -(tip[0] - base[0]) * bulge;
      path([
        [base, [mx + nx, my + ny], tip],
        [base, [mx - nx, my - ny], tip],
      ], line * 0.8);
      path([
        [base, [mx + nx * 0.35, my + ny * 0.35], tip],
        [base, [mx - nx * 0.35, my - ny * 0.35], tip],
      ], line / 3);
    };
    blade([0.04, 0.5], 0.28);
    blade([0.96, 0.5], 0.28);
    blade([0.2, 0.36], 0.18);
    const spike = (cx: number, cy: number, tilt: number) => {
      path([[[0.5, 0.97], [0.5 + (cx - 0.5) * 0.3, 0.6], [cx, cy + 0.1]]], line * 0.8);
      ctx.beginPath();
      ctx.ellipse(...at([cx, cy]), 0.06 * s, 0.11 * s, tilt, 0, 2 * Math.PI);
      ctx.fill();
      for (let k = 0; k < 9; k++) {
        const t = (k * 2 * Math.PI) / 9;
        const end: P = [cx + 0.12 * Math.cos(t), cy + 0.05 + 0.07 * Math.sin(t)];
        path([[[cx, cy + 0.05], [cx, cy + 0.05], end]], line / 3);
        circle(end, 0.012, "#000", line / 3);
      }
    };
    spike(0.5, 0.14, 0);
    spike(0.76, 0.26, 0.4);
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

/** Jam / syrup label: line art left; variety, note and month right. */
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
  centered(ctx, item.product_name, cx, 8 * uy, max, 5.2 * u, "700", serif);
  ctx.lineWidth = line / 2;
  ctx.beginPath();
  ctx.moveTo(25 * ux, 12.2 * uy);
  ctx.lineTo(45 * ux, 12.2 * uy);
  ctx.stroke();
  centered(ctx, item.note || l("jar_homemade"), cx, 15.8 * uy, max, 2.8 * u);
  centered(ctx, date, cx, 20 * uy, max, 2.8 * u);
  return threshold(canvas);
}
