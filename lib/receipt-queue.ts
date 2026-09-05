import amqp from "amqplib";
import { SpanStatusCode, trace } from "@opentelemetry/api";

export const receiptExchangeName = process.env.RABBITMQ_RECEIPT_EXCHANGE ?? "pantry-pal.receipts";
export const receiptQueueName = process.env.RABBITMQ_RECEIPT_QUEUE ?? "pantry-pal.receipt-worker";
export const receiptRoutingKey = process.env.RABBITMQ_RECEIPT_ROUTING_KEY ?? "receipt.email";
export const printQueueName = process.env.RABBITMQ_PRINT_QUEUE ?? "pantry-pal.print-worker";
export const printRoutingKey = process.env.RABBITMQ_PRINT_ROUTING_KEY ?? "receipt.print";

export type ReceiptMessage = {
  recipient: string;
  purchaseId: string;
};

export async function publishReceiptMessage(message: ReceiptMessage) {
  return publishMessage(message, receiptQueueName, receiptRoutingKey, "receipt.publish");
}

export async function publishPrintMessage(message: Pick<ReceiptMessage, "purchaseId">) {
  return publishMessage(message, printQueueName, printRoutingKey, "receipt.print.publish");
}

async function publishMessage(message: object, queueName: string, routingKey: string, spanName: string) {
  const tracer = trace.getTracer("pantry-pal.receipt-publisher");
  return tracer.startActiveSpan(spanName, async (span) => {
    span.setAttributes({
      "messaging.system": "rabbitmq",
      "messaging.destination.name": receiptExchangeName,
      "messaging.rabbitmq.routing_key": routingKey,
      ...(typeof (message as ReceiptMessage).purchaseId === "string" ? { "receipt.purchase_id": (message as ReceiptMessage).purchaseId } : {}),
    });
    let connection: amqp.ChannelModel | undefined;
    try {
      connection = await amqp.connect(process.env.RABBITMQ_URL ?? "amqp://localhost:5672");
      const channel = await connection.createConfirmChannel();
      await channel.assertExchange(receiptExchangeName, "direct", { durable: true });
      await channel.assertQueue(queueName, { durable: true });
      await channel.bindQueue(queueName, receiptExchangeName, routingKey);
      channel.publish(receiptExchangeName, routingKey, Buffer.from(JSON.stringify(message)), {
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
