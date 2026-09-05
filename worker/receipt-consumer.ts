import "dotenv/config";
import "../instrumentation.node";
import amqp from "amqplib";
import nodemailer from "nodemailer";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { receiptExchangeName, receiptQueueName, receiptRoutingKey, type ReceiptMessage } from "@/lib/receipt-queue";

const rabbitUrl = process.env.RABBITMQ_URL ?? "amqp://localhost:5672";
const receiptApiUrl = (process.env.RECEIPT_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const internalToken = process.env.RECEIPT_INTERNAL_TOKEN;
const tracer = trace.getTracer("pantry-pal.receipt-worker");

class NonRetryableReceiptError extends Error {}

if (!internalToken) throw new Error("RECEIPT_INTERNAL_TOKEN is required");
if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error("SMTP_HOST and SMTP_FROM are required");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
});

function parseMessage(content: Buffer): ReceiptMessage {
  const message = JSON.parse(content.toString("utf8")) as Partial<ReceiptMessage>;
  if (typeof message.recipient !== "string" || !message.recipient.includes("@")) throw new Error("Invalid receipt recipient");
  if (typeof message.purchaseId !== "string" || !message.purchaseId) throw new Error("Invalid purchase id");
  return { recipient: message.recipient, purchaseId: message.purchaseId };
}

async function sendReceipt(message: ReceiptMessage) {
  const pdf = await tracer.startActiveSpan("receipt.fetch_pdf", async (span) => {
    span.setAttribute("receipt.purchase_id", message.purchaseId);
    try {
      const response = await fetch(`${receiptApiUrl}/api/purchases/${encodeURIComponent(message.purchaseId)}/receipt`, {
        headers: { Authorization: `Bearer ${internalToken}` },
      });
      span.setAttribute("http.response.status_code", response.status);
      if (!response.ok) {
        const error = new Error(`Receipt API returned ${response.status}`);
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new NonRetryableReceiptError(error.message);
        }
        throw error;
      }
      const result = Buffer.from(await response.arrayBuffer());
      span.setAttribute("receipt.pdf.size_bytes", result.length);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });

  await tracer.startActiveSpan("receipt.send_email", async (span) => {
    span.setAttribute("receipt.purchase_id", message.purchaseId);
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: message.recipient,
        subject: `Pantry Pal receipt ${message.purchaseId}`,
        text: "Your Pantry Pal purchase receipt is attached.",
        attachments: [{ filename: `pantry-pal-receipt-${message.purchaseId}.pdf`, content: pdf, contentType: "application/pdf" }],
      });
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function main() {
  const connection = await amqp.connect(rabbitUrl);
  const channel = await connection.createChannel();
  await channel.assertExchange(receiptExchangeName, "direct", { durable: true });
  await channel.assertQueue(receiptQueueName, { durable: true });
  await channel.bindQueue(receiptQueueName, receiptExchangeName, receiptRoutingKey);
  await channel.prefetch(1);
  console.log(`Consuming ${receiptRoutingKey} messages from ${receiptExchangeName} via ${receiptQueueName}`);

  await channel.consume(receiptQueueName, async (message) => {
    if (!message) return;
    await tracer.startActiveSpan("receipt.process", async (span) => {
      span.setAttributes({
        "messaging.system": "rabbitmq",
        "messaging.destination.name": receiptExchangeName,
        "messaging.rabbitmq.routing_key": receiptRoutingKey,
      });
      try {
        await sendReceipt(parseMessage(message.content));
        channel.ack(message);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        const retryable = !(error instanceof NonRetryableReceiptError);
        console.error(`Receipt delivery failed; message will ${retryable ? "be retried" : "be acknowledged and dropped"}`, error);
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        span.setStatus({ code: SpanStatusCode.ERROR });
        if (!retryable) {
          channel.ack(message);
        } else {
          channel.nack(message, false, true);
        }
      } finally {
        span.end();
      }
    });
  });

  const close = async () => {
    await channel.close().catch(() => undefined);
    await connection.close().catch(() => undefined);
    process.exit(0);
  };
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
