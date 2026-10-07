// Sharing helpers: a "my tree" story card rendered in the browser, and a calendar file for the
// voting plan. Nothing here leaves the device unless the person shares it.

const PROPS = ["fill", "stroke", "opacity", "font-family", "font-size", "font-weight", "paint-order", "stroke-width"] as const;

// An SVG copied into an <img> loses the page's CSS, so copy the computed look onto the clone.
function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src);
  const style = PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
  dst.setAttribute("style", style);
  for (let k = 0; k < src.children.length; k++) inlineStyles(src.children[k], dst.children[k]);
}

function svgImage(svg: SVGSVGElement, w: number, h: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  // CSS variables used inside attributes (fill="var(--gold)") must become real colours too.
  const root = getComputedStyle(document.documentElement);
  let xml = new XMLSerializer().serializeToString(clone);
  xml = xml.replace(/var\((--[a-z0-9-]+)\)/g, (_, v: string) => root.getPropertyValue(v).trim() || "#000");
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** The scene (pixel canvas + vector layer) on a 1080x1920 card, for a WhatsApp status or a story. */
export async function storyCard(scene: HTMLCanvasElement, lines: { title: string; big: string; sub: string; link: string }) {
  await document.fonts.ready;
  const W = 1080;
  const H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const v = (n: string) => css.getPropertyValue(n).trim();

  g.fillStyle = v("--bg") || "#eef4fa";
  g.fillRect(0, 0, W, H);
  // the flag's double stripes, top and bottom
  g.fillStyle = v("--flag") || "#0038b8";
  for (const y of [70, 120, H - 140, H - 90]) g.fillRect(0, y, W, 22);

  const sw = W - 120;
  const sh = Math.round((sw * scene.height) / scene.width);
  g.imageSmoothingEnabled = false; // keep the pixels square
  g.drawImage(scene, 60, 560, sw, sh);
  const vector = scene.parentElement?.querySelector<SVGSVGElement>("svg.scene-vector");
  if (vector) g.drawImage(await svgImage(vector, scene.width, scene.height), 60, 560, sw, sh);
  g.lineWidth = 9;
  g.strokeStyle = v("--ink") || "#0b1a3d";
  g.strokeRect(60, 560, sw, sh);

  g.direction = "rtl";
  g.textAlign = "center";
  g.fillStyle = v("--ink") || "#0b1a3d";
  g.font = '700 120px "Fredoka", "Rubik", sans-serif';
  g.fillText(lines.title, W / 2, 330);
  g.font = '500 54px "Rubik", sans-serif';
  g.fillText(lines.sub, W / 2, 440);
  g.font = '700 92px "Fredoka", "Rubik", sans-serif';
  g.fillText(lines.big, W / 2, 560 + sh + 170);
  g.font = '500 46px "Rubik", sans-serif';
  g.fillStyle = v("--flag") || "#0038b8";
  g.direction = "ltr";
  g.fillText(lines.link, W / 2, 560 + sh + 270);

  return new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), "image/png"));
}

export async function shareOrDownload(blob: Blob, name: string, text: string) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text }).catch(() => {});
    return "shared";
  }
  download(blob, name);
  return "downloaded";
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Election day is 27.10.2026, Israel on winter time (UTC+2). Times are the plan's slot.
const SLOT_UTC: Record<string, string> = { "בבוקר": "060000", "בצהריים": "110000", "אחרי העבודה": "160000" };

export function voteIcs(plan: { when: string; how: string; with: string }, lookup: string) {
  const start = SLOT_UTC[plan.when] ?? "060000";
  const end = String(Number(start.slice(0, 2)) + 1).padStart(2, "0") + start.slice(2);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const desc = `התוכנית: ${plan.when}, ${plan.how}, ${plan.with}.\\nלקחת תעודה מזהה עם תמונה: תעודת זהות, דרכון או רישיון נהיגה.\\nאיפה הקלפי: ${lookup}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//vote-tree//he",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:vote-${stamp}@vote-tree`,
    `DTSTAMP:${stamp}`,
    `DTSTART:20261027T${start}Z`,
    `DTEND:20261027T${end}Z`,
    "SUMMARY:הולכים להצביע",
    `DESCRIPTION:${desc}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:עוד שעה הולכים להצביע",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Blob([ics], { type: "text/calendar;charset=utf-8" });
}

/**
 * Shrinks a camera photo to at most 900px and re-encodes it as JPEG in the browser. Re-encoding
 * through a canvas drops all metadata, so the phone's GPS position never leaves the device.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  for (const q of [0.78, 0.65, 0.5]) {
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", q));
    if (blob.size <= 440_000) return blob;
  }
  throw new Error("photo_size");
}
