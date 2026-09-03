import amqp from "amqplib";
import { SpanStatusCode, trace } from "@opentelemetry/api";

export const receiptExchangeName = process.env.RABBITMQ_RECEIPT_EXCHANGE ?? "pantry-pal.receipts";
export const receiptQueueName = process.env.RABBITMQ_RECEIPT_QUEUE ?? "pantry-pal.receipt-worker";
export const receiptRoutingKey = process.env.RABBITMQ_RECEIPT_ROUTING_KEY ?? "receipt.email";

export type ReceiptMessage = {
  recipient: string;
  purchaseId: string;
};

export async function publishReceiptMessage(message: ReceiptMessage) {
  const tracer = trace.getTracer("pantry-pal.receipt-publisher");
  return tracer.startActiveSpan("receipt.publish", async (span) => {
    span.setAttributes({
      "messaging.system": "rabbitmq",
      "messaging.destination.name": receiptExchangeName,
      "messaging.rabbitmq.routing_key": receiptRoutingKey,
      "receipt.purchase_id": message.purchaseId,
    });
    let connection: amqp.ChannelModel | undefined;
    try {
      connection = await amqp.connect(process.env.RABBITMQ_URL ?? "amqp://localhost:5672");
      const channel = await connection.createConfirmChannel();
      await channel.assertExchange(receiptExchangeName, "direct", { durable: true });
      await channel.assertQueue(receiptQueueName, { durable: true });
      await channel.bindQueue(receiptQueueName, receiptExchangeName, receiptRoutingKey);
      channel.publish(receiptExchangeName, receiptRoutingKey, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        contentType: "application/json",
      });
      await channel.waitForConfirms();
      await channel.close();
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      await connection?.close().catch(() => undefined);
      span.end();
    }
  });
}
