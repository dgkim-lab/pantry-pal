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

For OpenTelemetry, inject these non-secret settings from the collector service
configured by GitOps:

- `OTEL_SERVICE_NAME=pantry-pal`
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318`
- `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,k8s.namespace.name=pantry`
- optionally `OTEL_TRACES_SAMPLER=parentbased_always_on`

## Deployment responsibilities

The GitOps repository should define:

- Deployment, Service, and health probes for the Next.js runtime
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
4. Mark the release healthy only after the runtime readiness probe succeeds.

Migrations should be backward-compatible with the currently running version when rolling updates can overlap versions.

## Suggested container commands

The final implementation should expose stable commands such as:

```text
npm run start       # production web runtime
npm run db:migrate  # deploy Prisma migrations and exit
```

The exact command names may change during implementation, but the GitOps repository should reference commands rather than reaching into container internals.
