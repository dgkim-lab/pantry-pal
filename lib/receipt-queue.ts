import amqp from "amqplib";

export const receiptExchangeName = process.env.RABBITMQ_RECEIPT_EXCHANGE ?? "pantry-pal.receipts";
export const receiptQueueName = process.env.RABBITMQ_RECEIPT_QUEUE ?? "pantry-pal.receipt-worker";
export const receiptRoutingKey = process.env.RABBITMQ_RECEIPT_ROUTING_KEY ?? "receipt.email";

export type ReceiptMessage = {
  recipient: string;
  purchaseId: string;
};

export async function publishReceiptMessage(message: ReceiptMessage) {
  const connection = await amqp.connect(process.env.RABBITMQ_URL ?? "amqp://localhost:5672");
  try {
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
  } finally {
    await connection.close();
  }
}
