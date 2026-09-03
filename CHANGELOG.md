# Changelog

## [Unreleased]

Future changes will be listed here.

- Added a concise shopping-list detail summary for items still to get and their total expected price.
- Ordered shopping-list detail items alphabetically in both the “to get” and in-cart sections.
- Added downloadable PDF purchase receipts with embedded Korean font support.
- Added RabbitMQ exchange-based receipt delivery and a standalone SMTP email worker.
- Documented local receipt testing and GitOps deployment requirements for the worker.
- Added purchase deletion from history with an explicit confirmation dialog.
- Added receipt publisher tracing and graceful checkout behavior when RabbitMQ is unavailable.
- Added receipt-worker spans for RabbitMQ processing, PDF retrieval, and SMTP delivery.

## [0.2.0] - 2026-09-03

- Added household creation and household switching.
- Added member invitations with expiring invitation tokens and invitee acceptance UI.
- Added household member lists and owner/editor/viewer role management.
- Enforced household membership and role permissions across mutations.
- Added account/profile and sign-out UI.
- Added a shared household selector with responsive desktop and mobile navigation behavior.
- Added an authenticated household data endpoint for shared navigation state.
- Added health checks, client error telemetry, OpenTelemetry instrumentation, and production PWA icon assets.
- Improved catalog quick-add/deduplication, cart quantity editing, purchase-date timezone handling, and responsive list/cart UI.

## [0.1.0] - 2026-08-31

- Added OIDC authentication with Cognito logout support.
- Added shopping-list creation, editing, deletion, item autocomplete, and item detail attributes.
- Added reusable master-item catalog creation, editing, deletion, and list reuse.
- Added cart creation, item editing, removal, restoration, store selection, and totals.
- Added store CRUD with local and online store details.
- Added checkout for purchase date, currency, notes, actual prices, and quantities.
- Added purchase history with immutable purchase snapshots and buy-again actions.
- Added PostgreSQL persistence with Prisma migrations and household-scoped data access.
- Added the initial responsive Pantry Pal interface, PWA manifest, and navigation structure.
