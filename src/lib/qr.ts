// QR codes for sharing. Loaded only when someone asks for one, since the QR
// library is most of the page script's size otherwise.
import qrcode from "qrcode-generator";

/** A QR code for the URL as a PNG data URL, black on white so it scans in any theme. */
export function qrPng(url: string, cellSize = 8): string {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const margin = 4 * cellSize; // the standard 4-module quiet zone
  const size = qr.getModuleCount() * cellSize + margin * 2;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.translate(margin, margin);
  qr.renderTo2dContext(ctx, cellSize);
  return canvas.toDataURL("image/png");
}
