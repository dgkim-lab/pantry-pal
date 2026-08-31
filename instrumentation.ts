export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ NodeSDK }, { OTLPTraceExporter }, { PrismaInstrumentation }, resources, semantic] =
    await Promise.all([
      import("@opentelemetry/sdk-node"),
      import("@opentelemetry/exporter-trace-otlp-http"),
      import("@prisma/instrumentation"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/semantic-conventions"),
    ]);

  const sdk = new NodeSDK({
    resource: resources.resourceFromAttributes({
      [semantic.ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "pantry-pal",
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [new PrismaInstrumentation()],
  });

  sdk.start();
}
