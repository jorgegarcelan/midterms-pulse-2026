import { MAP_HEIGHT, MAP_WIDTH, type MapShape } from "@/lib/playground/geo";

type ExportOptions = {
  shapes: MapShape[];
  fill: (code: string) => string;
  title: string;
  dem: number;
  rep: number;
  open: number;
  majority: number;
  total: number;
  verdict: string;
  labels: { dem: string; rep: string; open: string; majority: string };
  filename: string;
};

export const WATERMARK = "midterm-pulse-2026.vercel.app";

// Renders the user's map to a 1600×1200 PNG entirely in the browser (Path2D from the SVG path data).
export async function exportMapImage(options: ExportOptions) {
  const width = 1600, height = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  await document.fonts?.ready;
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;

  // Background with the site's two party glows.
  context.fillStyle = "#06070b";
  context.fillRect(0, 0, width, height);
  const glow = (x: number, y: number, r: number, color: string) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(6,7,11,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  };
  glow(160, -80, 900, "rgba(91,134,255,.22)");
  glow(1480, -60, 760, "rgba(255,90,110,.15)");

  // Header: title, totals and the seat bar.
  context.textBaseline = "alphabetic";
  context.fillStyle = "#8b8f99";
  context.font = font(500, 22);
  context.fillText("MIDTERM PULSE 2026", 70, 82);
  context.fillStyle = "#ffffff";
  context.font = font(650, 58);
  context.fillText(options.title, 70, 148);

  context.font = font(700, 76);
  context.fillStyle = "#9fb8ff";
  context.fillText(`D ${options.dem}`, 70, 250);
  context.textAlign = "right";
  context.fillStyle = "#ff9eaa";
  context.fillText(`${options.rep} R`, width - 70, 250);
  context.textAlign = "center";
  context.fillStyle = "#c9ccd3";
  context.font = font(500, 24);
  context.fillText(options.labels.majority, width / 2, 214);
  if (options.open > 0) { context.fillStyle = "#8b8f99"; context.fillText(`${options.open} ${options.labels.open.toLowerCase()}`, width / 2, 248); }
  context.textAlign = "left";

  const barX = 70, barY = 280, barW = width - 140, barH = 22;
  const unit = barW / options.total;
  context.save();
  context.beginPath();
  context.roundRect(barX, barY, barW, barH, 11);
  context.clip();
  context.fillStyle = "#23262f"; context.fillRect(barX, barY, barW, barH);
  context.fillStyle = "#4f7df5"; context.fillRect(barX, barY, options.dem * unit, barH);
  context.fillStyle = "#f0566b"; context.fillRect(barX + barW - options.rep * unit, barY, options.rep * unit, barH);
  context.restore();
  context.fillStyle = "#ffffff";
  context.fillRect(barX + (options.majority - .5) * unit - 1.5, barY - 6, 3, barH + 12);
  context.fillStyle = "#dfe2e8";
  context.font = font(500, 26);
  context.fillText(options.verdict, 70, 352);

  // Map.
  const mapTop = 390, mapHeight = 720;
  const scale = Math.min((width - 140) / MAP_WIDTH, mapHeight / MAP_HEIGHT);
  const offsetX = (width - MAP_WIDTH * scale) / 2;
  context.save();
  context.translate(offsetX, mapTop);
  context.scale(scale, scale);
  context.lineJoin = "round";
  const outlined = options.shapes.some((shape) => shape.outline);
  for (const shape of options.shapes) {
    const path = new Path2D(shape.d);
    const color = options.fill(shape.code);
    context.fillStyle = color;
    context.fill(path);
    context.strokeStyle = outlined ? color : "rgba(6,7,11,.8)";
    context.lineWidth = outlined ? .8 : .5;
    context.stroke(path);
  }
  if (outlined) {
    context.strokeStyle = "#06070b";
    context.lineWidth = 1.1;
    for (const shape of options.shapes) if (shape.outline) context.stroke(new Path2D(shape.outline));
  }
  context.restore();

  // Watermark.
  context.font = font(600, 26);
  context.fillStyle = "rgba(255,255,255,.82)";
  context.textAlign = "right";
  context.fillText(WATERMARK, width - 70, height - 44);
  context.textAlign = "left";
  context.font = font(500, 20);
  let legendX = 70;
  for (const [color, label] of [["#4f7df5", options.labels.dem], ["#f0566b", options.labels.rep], ["#3a3e4b", options.labels.open]]) {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(legendX, height - 64, 20, 20, 5);
    context.fill();
    context.fillStyle = "#a3a8b2";
    context.fillText(label, legendX + 30, height - 47);
    legendX += 30 + context.measureText(label).width + 30;
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Export failed");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
