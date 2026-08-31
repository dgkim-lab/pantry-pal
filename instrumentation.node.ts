import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, type ReadableSpan, type Span, type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const HEALTH_PROBE_PATH = "/api/healthz";

function isHealthProbeSpan(span: ReadableSpan) {
  const attributes = span.attributes;
  if (span.name.includes(HEALTH_PROBE_PATH)) return true;
  return [attributes["http.route"], attributes["url.path"], attributes["http.target"]].some(
    (value) => typeof value === "string" && value.split("?", 1)[0] === HEALTH_PROBE_PATH,
  );
}

class HealthProbeFilteringSpanProcessor implements SpanProcessor {
  constructor(private readonly delegate: SpanProcessor) {}

  onStart(span: Span, parentContext: Parameters<SpanProcessor["onStart"]>[1]) {
    this.delegate.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan) {
    if (!isHealthProbeSpan(span)) this.delegate.onEnd(span);
  }

  shutdown() {
    return this.delegate.shutdown();
  }

  forceFlush() {
    return this.delegate.forceFlush();
  }
}

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "pantry-pal",
  }),
  spanProcessors: [new HealthProbeFilteringSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter()))],
});

provider.register();
registerInstrumentations({
  instrumentations: [new PrismaInstrumentation()],
  tracerProvider: provider,
});
