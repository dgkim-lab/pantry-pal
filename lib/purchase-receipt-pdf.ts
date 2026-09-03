import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

type ReceiptLine = {
  name: string;
  quantity?: string;
  unit?: string;
  price?: string;
};

type Receipt = {
  id: string;
  householdName: string;
  storeName: string;
  purchasedAt: Date;
  currency: string;
  totalPrice: string | null;
  notes: string | null;
  items: ReceiptLine[];
};

const fontPath = join(process.cwd(), "public/fonts/NotoSansKR-subset.ttf");
const glyphMapPath = join(process.cwd(), "public/fonts/NotoSansKR-subset-cmap.json");
const embeddedFont = readFileSync(fontPath);
const glyphMap = JSON.parse(readFileSync(glyphMapPath, "utf8")) as Record<string, number>;

function pdfText(value: string) {
  // Identity-H text contains glyph IDs, not Unicode code points. The cmap
  // generated alongside the subset maps each Unicode character to its glyph.
  const bytes: number[] = [];
  for (const codePoint of value) {
    const code = codePoint.codePointAt(0)!;
    const glyphId = glyphMap[String(code)] ?? glyphMap["63"] ?? 0;
    bytes.push(glyphId >> 8, glyphId & 0xff);
  }
  return `<${Buffer.from(bytes).toString("hex").toUpperCase()}>`;
}

function wrap(value: string, length = 76) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && `${current} ${word}`.length > length) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function money(value: string | null, currency: string) {
  if (value === null) return "-";
  const amount = Number(value);
  return Number.isFinite(amount) ? `${currency} ${amount.toLocaleString("en-US")}` : `${currency} ${value}`;
}

export function createPurchaseReceiptPdf(receipt: Receipt) {
  const lines: string[] = [
    "PANTRY PAL",
    "PURCHASE RECEIPT",
    `Receipt: ${receipt.id}`,
    `Household: ${receipt.householdName}`,
    `Store: ${receipt.storeName}`,
    `Purchased: ${receipt.purchasedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`,
    "",
    "ITEMS",
  ];

  for (const item of receipt.items) {
    const details = [item.quantity && `qty ${item.quantity}`, item.unit, item.price && money(item.price, receipt.currency)]
      .filter(Boolean)
      .join(" | ");
    lines.push(...wrap(`${item.name}${details ? ` (${details})` : ""}`));
  }

  lines.push("", `TOTAL: ${money(receipt.totalPrice, receipt.currency)}`);
  if (receipt.notes) lines.push("", ...wrap(`Notes: ${receipt.notes}`));

  const pageHeight = 792;
  const margin = 54;
  const lineHeight = 16;
  const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / linesPerPage)) }, (_, index) =>
    lines.slice(index * linesPerPage, (index + 1) * linesPerPage),
  );

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontFileId = addObject("");
  const fontDescriptorId = addObject(`<< /Type /FontDescriptor /FontName /NotoSansKRSubset /Flags 32 /FontBBox [0 -300 1000 1100] /ItalicAngle 0 /Ascent 1069 /Descent -293 /CapHeight 1069 /StemV 80 /FontFile3 ${fontFileId} 0 R >>`);
  const cidFontId = addObject(`<< /Type /Font /Subtype /CIDFontType0 /BaseFont /NotoSansKRSubset /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${fontDescriptorId} 0 R /CIDToGIDMap /Identity /DW 1000 >>`);
  const fontId = addObject(`<< /Type /Font /Subtype /Type0 /BaseFont /NotoSansKRSubset /Encoding /Identity-H /DescendantFonts [${cidFontId} 0 R] >>`);
  const compressedFont = deflateSync(embeddedFont);
  objects[fontFileId - 1] = `<< /Length ${compressedFont.length} /Length1 ${embeddedFont.length} /Subtype /OpenType /Filter /FlateDecode >>\nstream\n${compressedFont.toString("latin1")}\nendstream`;
  const pageIds: number[] = [];

  for (const pageLines of pages) {
    const commands = ["BT", "/F1 11 Tf", `${margin} ${pageHeight - margin - 20} Td`];
    pageLines.forEach((line, index) => {
      const size = index === 0 ? 20 : index === 1 ? 14 : 11;
      if (index > 0) commands.push(`0 -${lineHeight} Td`);
      commands.push(`/F1 ${size} Tf ${pdfText(line)} Tj`);
    });
    commands.push("ET");
    const stream = commands.join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
    pageIds.push(addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  const chunks = ["%PDF-1.4\n%\xFF\xFF\xFF\xFF\n"];
  const offsets = [0];
  let offset = Buffer.byteLength(chunks[0], "binary");
  objects.forEach((body, index) => {
    const object = `${index + 1} 0 obj\n${body}\nendobj\n`;
    offsets.push(offset);
    chunks.push(object);
    offset += Buffer.byteLength(object, "binary");
  });
  const xrefOffset = offset;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  chunks.push(offsets.slice(1).map((item) => `${String(item).padStart(10, "0")} 00000 n \n`).join(""));
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(""), "binary");
}
