# Pantry Pal TODO

This backlog tracks work remaining after the initial list → cart vertical slice.

## Priority 1 — Core product workflow

- [x] Add shopping-list rename and delete actions. Archive remains future work.
- [x] Add autocomplete suggestions while typing item names.
- [x] Add editable shopping-list item details: quantity, unit, capacity, brand, notes, and expected price.
- [x] Add a master-item catalog with create, edit, and reuse actions. Archive remains future work.
- [x] Add cart-item editing for quantity, unit, capacity, notes, expected price, and store.
- [x] Add cart-item removal and restore behavior for active carts.
- [x] Add store CRUD screens with local/online type, address, URL, and notes.
- [x] Add store selection to carts and purchases.
- [x] Add checkout form for actual price, quantity, capacity, purchase date, currency, and notes.
- [x] Calculate and display cart/purchase totals.
- [ ] Add purchase-history filters for item, store, date, and price. Basic history display is implemented.
- [x] Add “buy again” from a purchase to a selected shopping list.
- [ ] Add configurable default attributes for master items and apply them when creating shopping-list items.

## Priority 2 — Collaboration and account management

- [ ] Add household creation and household switching.
- [ ] Add member invitation flow.
- [ ] Add member list and owner/editor/viewer role management.
- [ ] Enforce role permissions consistently in every mutation.
- [ ] Add account/profile and sign-out UI.

## Priority 3 — PWA and user experience

- [ ] Add production PWA icons and favicon assets.
- [ ] Add service-worker caching for the app shell and static assets.
- [ ] Add install guidance for iPhone Safari and desktop browsers.
- [ ] Keep data mutations online-only; show a clear offline/unavailable state.
- [ ] Add pending, success, and error feedback for server actions.
- [ ] Add empty, loading, and not-found states for every screen.
- [ ] Improve keyboard navigation, focus states, labels, and screen-reader behavior.
- [ ] Add locale, timezone, and currency settings beyond the defaults (`en`, `Asia/Seoul`, `KRW`).

## Priority 4 — Reliability and security

- [ ] Remove the temporary “Test client error” navigation button after verifying client exception telemetry.
- [ ] Add schema/input validation with user-facing validation errors.
- [ ] Add automated tests for list access and role authorization.
- [ ] Add integration tests for add → cart → uncart → checkout.
- [ ] Add purchase snapshot regression tests to ensure master-item edits do not change history.
- [ ] Test Cognito directly and Cognito → Keycloak federation flows.
- [ ] Document the required Cognito app-client settings and endpoint environment variables.
- [ ] Add structured server logging and an error-reporting strategy.
- [ ] Review session, cookie, headers, rate limits, and secret handling for production.

## Priority 5 — Operations

- [ ] Decide whether to retain the current rewritten initial migration or create a forward migration for any database that used the old schema.
- [ ] Add container health/readiness endpoints and wire them into the GitOps handoff.
- [ ] Add CI for install, Prisma validation/generation, typecheck, tests, and production build.
- [ ] Publish the container image using the Git commit SHA or digest.
- [ ] Add GitOps repository configuration for migration Job, runtime Deployment, ingress, secrets, and TLS.
- [ ] Document PostgreSQL backup and restore ownership.
