#!/usr/bin/env python3
"""Render receipt text with a Korean font and print it to an Xprinter."""

import json
import os
from pathlib import Path

import pika
from receipt_printing import fetch_receipt, print_receipt, shutdown_tracing, span_scope


RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://localhost:5672")
EXCHANGE = os.getenv("RABBITMQ_RECEIPT_EXCHANGE", "pantry-pal.receipts")
QUEUE = os.getenv("RABBITMQ_PRINT_QUEUE", "pantry-pal.print-worker")
ROUTING_KEY = os.getenv("RABBITMQ_PRINT_ROUTING_KEY", "receipt.print")
API_URL = os.getenv("RECEIPT_API_URL", "http://localhost:3000").rstrip("/")
INTERNAL_TOKEN = os.getenv("RECEIPT_INTERNAL_TOKEN")
PRINTER_HOST = os.getenv("XPRINTER_HOST")
PRINTER_PORT = int(os.getenv("XPRINTER_PORT", "9100"))
PRINT_WIDTH = int(os.getenv("XPRINTER_PRINT_WIDTH", "580"))
PUBLIC_URL = os.getenv("RECEIPT_PUBLIC_URL", os.getenv("AUTH_URL", "http://localhost:3000")).rstrip("/")
DEFAULT_FONT_PATH = Path(__file__).resolve().parents[1] / "public/fonts/NotoSansKR-subset.ttf"
FONT_PATH = Path(os.getenv("RECEIPT_PRINT_FONT_PATH", str(DEFAULT_FONT_PATH)))
if not FONT_PATH.is_file() and DEFAULT_FONT_PATH.is_file():
    FONT_PATH = DEFAULT_FONT_PATH


def required_config() -> None:
    if not INTERNAL_TOKEN:
        raise RuntimeError("RECEIPT_INTERNAL_TOKEN is required")
    if not PRINTER_HOST:
        raise RuntimeError("XPRINTER_HOST is required")
    if not FONT_PATH.is_file():
        raise RuntimeError(f"Receipt font not found: {FONT_PATH}")


def on_message(channel, method, properties, body):
    with span_scope("receipt.process", {"messaging.system": "rabbitmq", "messaging.destination.name": EXCHANGE, "messaging.rabbitmq.routing_key": ROUTING_KEY}) as span:
        try:
            message = json.loads(body.decode("utf-8"))
            purchase_id = message.get("purchaseId")
            if not isinstance(purchase_id, str) or not purchase_id:
                raise ValueError("Invalid purchase id")
            receipt = fetch_receipt(purchase_id, API_URL, INTERNAL_TOKEN)
            print_receipt(receipt, PRINTER_HOST, PRINTER_PORT, print_width=PRINT_WIDTH, font_path=FONT_PATH, public_url=PUBLIC_URL)
            channel.basic_ack(method.delivery_tag)
            print(f"Printed receipt for purchase {purchase_id}", flush=True)
        except Exception as error:
            span.record_exception(error)
            print(f"Receipt printing failed; message will be retried: {error}", flush=True)
            channel.basic_nack(method.delivery_tag, requeue=True)


def main():
    required_config()
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    channel = connection.channel()
    channel.exchange_declare(exchange=EXCHANGE, exchange_type="direct", durable=True)
    channel.queue_declare(queue=QUEUE, durable=True)
    channel.queue_bind(queue=QUEUE, exchange=EXCHANGE, routing_key=ROUTING_KEY)
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=QUEUE, on_message_callback=on_message)
    print(f"Consuming {ROUTING_KEY} from {EXCHANGE} via {QUEUE}; printer={PRINTER_HOST}:{PRINTER_PORT}", flush=True)
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()
    finally:
        connection.close()
        shutdown_tracing()


if __name__ == "__main__":
    main()
