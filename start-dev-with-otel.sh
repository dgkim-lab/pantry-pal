#!/usr/bin/env bash

set -Eeuo pipefail

otel_namespace="${OTEL_NAMESPACE:-observability}"
otel_service="${OTEL_SERVICE:-otel-collector}"
local_port="${OTEL_LOCAL_PORT:-4318}"
remote_port="${OTEL_REMOTE_PORT:-4318}"
otel_endpoint="http://127.0.0.1:${local_port}"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required to run local development with OpenTelemetry." >&2
  exit 1
fi

echo "Forwarding ${otel_service} in namespace ${otel_namespace} from localhost:${local_port} to port ${remote_port}..."
kubectl --namespace "${otel_namespace}" port-forward "service/${otel_service}" "${local_port}:${remote_port}" &
port_forward_pid=$!

cleanup() {
  kill "${port_forward_pid}" 2>/dev/null || true
  wait "${port_forward_pid}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1
if ! kill -0 "${port_forward_pid}" 2>/dev/null; then
  echo "kubectl port-forward failed. Check OTEL_NAMESPACE and OTEL_SERVICE." >&2
  exit 1
fi

echo "Starting Next.js with OTEL_EXPORTER_OTLP_ENDPOINT=${otel_endpoint}"
OTEL_EXPORTER_OTLP_ENDPOINT="${otel_endpoint}" npm run dev -- "$@"
