#!/usr/bin/env python3
"""Fetch one real receipt, show its text, save its PNG, and print it."""

import argparse
import os
from pathlib import Path

from receipt_printing import fetch_receipt, print_receipt, receipt_text, shutdown_tracing


def main():
    parser = argparse.ArgumentParser(description="Fetch, render, and print a Pantry Pal receipt")
    parser.add_argument("--purchase-id", required=True)
    parser.add_argument("--api-url", default=os.getenv("RECEIPT_API_URL", "http://localhost:3000"))
    parser.add_argument("--token", default=os.getenv("RECEIPT_INTERNAL_TOKEN"))
    parser.add_argument("--host", default=os.getenv("XPRINTER_HOST"))
    parser.add_argument("--port", type=int, default=int(os.getenv("XPRINTER_PORT", "9100")))
    parser.add_argument("--width", type=int, default=int(os.getenv("XPRINTER_PRINT_WIDTH", "580")))
    parser.add_argument("--font", default=os.getenv("RECEIPT_PRINT_FONT_PATH"))
    args = parser.parse_args()
    if not args.host:
        parser.error("--host or XPRINTER_HOST is required")
    if not args.token:
        parser.error("--token or RECEIPT_INTERNAL_TOKEN is required")

    try:
        receipt = fetch_receipt(args.purchase_id, args.api_url, args.token)
        print(receipt_text(receipt), flush=True)
        output_path = Path("/tmp") / f"pantry-pal-receipt-{receipt['id']}.png"
        print_receipt(receipt, args.host, args.port, output_path=str(output_path), print_width=args.width, font_path=args.font)
        print(f"Saved generated image to {output_path}", flush=True)
    finally:
        shutdown_tracing()


if __name__ == "__main__":
    main()
