import bwipjs from "bwip-js/node";

function barcodeType(value: string) {
  if (/^\d{8}$/.test(value)) return "ean8";
  if (/^\d{12}$/.test(value)) return "upca";
  if (/^\d{13}$/.test(value)) return "ean13";
  return "code128";
}

export function barcodeImageDataUri(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  try {
    const svg = bwipjs.toSVG({
      bcid: barcodeType(normalized),
      text: normalized,
      scale: 2,
      height: 12,
      includetext: true,
      textsize: 10,
      textxalign: "center",
    });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return null;
  }
}
