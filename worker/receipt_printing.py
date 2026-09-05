"""Shared receipt formatting, PNG rendering, QR generation, and Xprinter output."""

import os
import tempfile
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Status, StatusCode
import qrcode
import requests
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont
from escpos.printer import Network


load_dotenv()

_tracer_provider = TracerProvider(resource=Resource.create({
    "service.name": os.getenv("OTEL_SERVICE_NAME", "pantry-pal-receipt-print-worker"),
}))
_otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318").rstrip("/")
if not _otlp_endpoint.endswith("/v1/traces"):
    _otlp_endpoint += "/v1/traces"
_tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=_otlp_endpoint)))
trace.set_tracer_provider(_tracer_provider)
tracer = trace.get_tracer("pantry-pal.receipt-print-worker")

DEFAULT_FONT_PATH = Path(__file__).resolve().parents[1] / "public/fonts/NotoSansKR-subset.ttf"


@contextmanager
def span_scope(name, attributes=None):
    with tracer.start_as_current_span(name) as span:
        for key, value in (attributes or {}).items():
            span.set_attribute(key, value)
        try:
            yield span
        except Exception as error:
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR))
            raise
        else:
            if span.status.status_code != StatusCode.ERROR:
                span.set_status(Status(StatusCode.OK))


def shutdown_tracing():
    _tracer_provider.shutdown()


def money(value, currency):
    if value is None:
        return "-"
    symbol = "₩" if currency == "KRW" else currency
    try:
        return f"{symbol}{float(value):,.0f}"
    except (TypeError, ValueError):
        return f"{symbol}{value}"


def receipt_lines(receipt):
    lines = [
        ("PANTRY PAL", 40), ("PURCHASE RECEIPT", 40), ("Receipt:", 24),
        (receipt["id"], 24), (f"Household: {receipt['householdName']}", 24),
        (f"Store: {receipt['storeName']}", 24),
        (f"Purchased: {datetime.fromisoformat(receipt['purchasedAt'].replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M')} UTC", 24),
        ("", 24), ("ITEMS", 40),
    ]
    lines.extend(("item", item) for item in receipt["items"])
    lines.append(("total", money(receipt.get("totalPrice"), receipt["currency"])))
    if receipt.get("notes"):
        lines.extend([("", 24), (f"Notes: {receipt['notes']}", 24)])
    return lines


def receipt_text(receipt):
    """Return a concise text preview using the same receipt data as the PNG."""
    lines = ["PANTRY PAL", "PURCHASE RECEIPT", "Receipt:", receipt["id"],
             f"Household: {receipt['householdName']}", f"Store: {receipt['storeName']}", "", "ITEMS"]
    for item in receipt["items"]:
        quantity = item.get("quantity") or "-"
        unit_price = money(item.get("unitPrice"), receipt["currency"])
        price = money(item.get("price"), receipt["currency"])
        lines.append(f"{item['name']}    qty {quantity}  {unit_price}  {price}")
    lines.append(f"TOTAL: {money(receipt.get('totalPrice'), receipt['currency'])}")
    if receipt.get("notes"):
        lines.extend(["", f"Notes: {receipt['notes']}"])
    return "\n".join(lines)


def render_receipt(receipt, path, print_width=580, font_path=None, public_url=None):
    with span_scope("receipt.render_png", {"receipt.purchase_id": receipt["id"], "receipt.print_width": print_width}):
        font_path = Path(font_path or os.getenv("RECEIPT_PRINT_FONT_PATH", str(DEFAULT_FONT_PATH)))
        if not font_path.is_file() and DEFAULT_FONT_PATH.is_file():
            font_path = DEFAULT_FONT_PATH
        public_url = (public_url or os.getenv("RECEIPT_PUBLIC_URL", os.getenv("AUTH_URL", "http://localhost:3000"))).rstrip("/")
        fonts = {}
        probe = ImageDraw.Draw(Image.new("RGB", (1, 1), "white"))
        total_height = 0
        wrapped = []
        for row in receipt_lines(receipt):
            if row[0] in ("item", "total"):
                wrapped.append(row)
                total_height += 48 if row[0] == "total" else 32
                continue
            text, size = row
            font = fonts.setdefault(size, ImageFont.truetype(font_path, size))
            current = ""
            for character in text:
                candidate = current + character
                if current and probe.textbbox((0, 0), candidate, font=font)[2] > print_width - 20:
                    wrapped.append((current, font))
                    total_height += size + 8
                    current = character
                else:
                    current = candidate
            wrapped.append((current, font))
            total_height += size + 8

        qr_size = min(190, print_width - 32)
        image = Image.new("RGB", (print_width, total_height + qr_size + 8), "white")
        draw = ImageDraw.Draw(image)
        y = 0
        for row in wrapped:
            if row[0] == "item":
                item = row[1]
                item_font = fonts.setdefault(24, ImageFont.truetype(font_path, 24))
                quantity = f"qty {item['quantity']}" if item.get("quantity") else "qty -"
                unit_price = money(item.get("unitPrice"), receipt["currency"]) if item.get("unitPrice") else "-"
                price = money(item.get("price"), receipt["currency"]) if item.get("price") else "-"
                qty_x, unit_price_x, price_x = 270, 430, print_width - 8
                name = item["name"]
                name_limit = qty_x - draw.textbbox((0, 0), quantity, font=item_font)[2] - 12
                while name and draw.textbbox((8, y), name, font=item_font)[2] > name_limit:
                    name = name[:-1]
                draw.text((8, y), name, fill="black", font=item_font)
                draw.text((qty_x, y), quantity, fill="black", font=item_font, anchor="ra")
                draw.text((unit_price_x, y), unit_price, fill="black", font=item_font, anchor="ra")
                draw.text((price_x, y), price, fill="black", font=item_font, anchor="ra")
                y += item_font.size + 8
                continue
            if row[0] == "total":
                total_font = fonts.setdefault(40, ImageFont.truetype(font_path, 40))
                draw.text((8, y), "TOTAL:", fill="black", font=total_font)
                draw.text((print_width - 8, y), row[1], fill="black", font=total_font, anchor="ra")
                y += total_font.size + 8
                continue
            text, font = row
            draw.text((8, y), text, fill="black", font=font)
            y += font.size + 8

        qr = qrcode.make(f"{public_url}/receipts/{receipt['id']}").convert("RGB").resize((qr_size, qr_size))
        image.paste(qr, ((print_width - qr_size) // 2, y + 4))
        image.save(path, "PNG")


def fetch_receipt(purchase_id, api_url, internal_token):
    with span_scope("receipt.fetch_json", {"receipt.purchase_id": purchase_id, "server.address": api_url}):
        response = requests.get(
            f"{api_url.rstrip('/')}/api/purchases/{purchase_id}/receipt",
            headers={"Authorization": f"Bearer {internal_token}", "Accept": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()


def print_receipt(receipt, host, port=9100, output_path=None, print_width=580, font_path=None, public_url=None):
    temporary = output_path is None
    if temporary:
        image_file = tempfile.NamedTemporaryFile(suffix=".png")
        output_path = image_file.name
    try:
        render_receipt(receipt, output_path, print_width, font_path, public_url)
        with span_scope("receipt.print_escpos", {"receipt.purchase_id": receipt["id"], "server.address": host, "server.port": port}):
            printer = Network(host, port=port, timeout=30)
            try:
                printer.image(output_path)
                printer.cut()
            finally:
                printer.close()
    finally:
        if temporary:
            image_file.close()
