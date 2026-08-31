import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("pantry-pal.client-errors");

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.slice(0, maxLength) : undefined;
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = textValue(payload.message, 500);
  if (!message) return Response.json({ error: "Missing error message" }, { status: 400 });

  await tracer.startActiveSpan("client.exception", async (span) => {
    span.setAttributes({
      "error.type": textValue(payload.name, 200) ?? "Error",
      "exception.message": message,
      "client.error.source": textValue(payload.source, 100) ?? "unknown",
      ...(textValue(payload.url, 500) ? { "client.error.url": textValue(payload.url, 500)! } : {}),
      ...(typeof payload.lineNumber === "number" ? { "client.error.line": payload.lineNumber } : {}),
      ...(typeof payload.columnNumber === "number" ? { "client.error.column": payload.columnNumber } : {}),
    });
    span.recordException({ name: textValue(payload.name, 200) ?? "Error", message, stack: textValue(payload.stack, 4000) });
    span.setStatus({ code: SpanStatusCode.ERROR, message });
    span.end();
  });

  return Response.json({ accepted: true }, { status: 202 });
}
