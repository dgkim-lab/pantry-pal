import "dotenv/config";
import amqp from "amqplib";
import nodemailer from "nodemailer";
import { receiptExchangeName, receiptQueueName, receiptRoutingKey, type ReceiptMessage } from "@/lib/receipt-queue";

const rabbitUrl = process.env.RABBITMQ_URL ?? "amqp://localhost:5672";
const receiptApiUrl = (process.env.RECEIPT_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const internalToken = process.env.RECEIPT_INTERNAL_TOKEN;

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
  const response = await fetch(`${receiptApiUrl}/api/purchases/${encodeURIComponent(message.purchaseId)}/receipt`, {
    headers: { Authorization: `Bearer ${internalToken}` },
  });
  if (!response.ok) throw new Error(`Receipt API returned ${response.status}`);
  const pdf = Buffer.from(await response.arrayBuffer());
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: message.recipient,
    subject: `Pantry Pal receipt ${message.purchaseId}`,
    text: "Your Pantry Pal purchase receipt is attached.",
    attachments: [{ filename: `pantry-pal-receipt-${message.purchaseId}.pdf`, content: pdf, contentType: "application/pdf" }],
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
    try {
      await sendReceipt(parseMessage(message.content));
      channel.ack(message);
    } catch (error) {
      console.error("Receipt delivery failed; message will be retried", error);
      channel.nack(message, false, true);
    }
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
