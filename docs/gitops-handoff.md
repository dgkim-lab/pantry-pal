# GitOps Repository Handoff

This repository owns the Pantry Pal application and its container image. The separate GitOps repository owns Kubernetes deployment configuration, image promotion, secrets, ingress, and runtime scaling.

## Image contract

Build one immutable image from this repository, for example:

```text
registry.example.com/pantry-pal:<git-sha>
```

The same image must support both:

- Web runtime: starts the Next.js production server.
- Migration job/init step: runs Prisma migrations and exits with a meaningful status.

The application image must not embed real credentials or environment-specific URLs.

## Runtime configuration supplied by GitOps

GitOps should inject the environment variables documented in [architecture.md](architecture.md), preferably from Kubernetes Secrets for credentials and ConfigMaps for non-secret defaults.

Required production values include:

- `DATABASE_URL`
- `AUTH_SECRET`
- `OIDC_ISSUER_URL`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `AUTH_URL`
- `AUTH_TRUST_HOST`

Receipt delivery also requires these values. Keep credentials and the internal
token in a Kubernetes Secret; queue/API endpoint and non-secret SMTP settings
may use a ConfigMap:

- `RABBITMQ_URL`
- `RABBITMQ_RECEIPT_EXCHANGE` (default: `pantry-pal.receipts`, durable direct exchange)
- `RABBITMQ_RECEIPT_QUEUE` (default: `pantry-pal.receipt-worker`, durable worker queue)
- `RABBITMQ_RECEIPT_ROUTING_KEY` (default: `receipt.email`)
- `RECEIPT_INTERNAL_TOKEN`
- `RECEIPT_API_URL` (the in-cluster URL of the web Service)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER` (if required by the SMTP server)
- `SMTP_PASSWORD` (if required by the SMTP server)
- `SMTP_FROM`

Set `OTEL_SERVICE_NAME=pantry-pal-receipt-worker` on the receipt-worker
Deployment so its RabbitMQ, PDF-fetch, and SMTP spans are distinguishable from
web-runtime spans. It uses the same `OTEL_EXPORTER_OTLP_ENDPOINT` and resource
attributes as the web Deployment.

For OpenTelemetry, inject these non-secret settings from the collector service
configured by GitOps:

- `OTEL_SERVICE_NAME=pantry-pal`
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318`
- `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,k8s.namespace.name=pantry`
- optionally `OTEL_TRACES_SAMPLER=parentbased_always_on`

## Deployment responsibilities

The GitOps repository should define:

- Deployment, Service, and health probes for the Next.js runtime. Configure the
  liveness/readiness HTTP probe path as `/api/healthz`; it returns HTTP 200 with
  `{ "status": "ok" }` and does not require authentication.
- A separate receipt-worker Deployment using the same image, with command
  `npm run worker:receipts`. It must receive the RabbitMQ, receipt API, token,
  and SMTP environment variables, and should use at least one replica with
  graceful termination so in-flight messages can be acknowledged or retried.
- RabbitMQ infrastructure (or a managed RabbitMQ service), a durable direct
  exchange and bound worker queue named by the receipt variables, and network
  policy allowing the web and receipt-worker Deployments to connect to it.
- A migration Job or release hook using the same image and migration command
- Ingress/TLS and the public `AUTH_URL`
- Secret and ConfigMap references
- Resource requests/limits and replica count
- Image tag/digest promotion
- PostgreSQL connectivity policy and backup ownership
- OTLP collector connectivity and trace retention/access policy. Prisma query
  spans may include SQL operation metadata, so apply the collector's normal
  database-attribute redaction policy.

## Migration ordering

1. Build and publish the application image.
2. Run the migration Job against the target database.
3. Roll out the web Deployment using that same image digest.
4. Roll out the receipt-worker Deployment using that same image digest.
5. Mark the release healthy only after the runtime readiness probe succeeds and
   RabbitMQ connectivity is available to the worker.

Migrations should be backward-compatible with the currently running version when rolling updates can overlap versions.

## Suggested container commands

The final implementation should expose stable commands such as:

```text
npm run start       # production web runtime
npm run db:migrate  # deploy Prisma migrations and exit
npm run worker:receipts # consume RabbitMQ messages and email PDF receipts
```

The exact command names may change during implementation, but the GitOps repository should reference commands rather than reaching into container internals.
