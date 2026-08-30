# Pantry Pal — Product Requirements

## 1. Goal

Pantry Pal helps households plan grocery purchases, buy items from local or online stores, and retain useful purchase history. The primary interaction should feel as quick as adding and checking items in iOS Reminders.

## 2. Users and access

- Every user must sign up or log in before using the application.
- A user can belong to multiple households/workspaces.
- A shopping list belongs to one household and can be accessed by multiple household members.
- Members have an owner, editor, or viewer role. Owners manage membership and list deletion; editors manage list items and purchases; viewers can read lists and history.
- A user may create multiple shopping lists in the same household.

## 3. Core concepts

### Master item

A reusable item template, such as “Milk” or “Rice.” Master-item fields are optional unless required by the UI:

- Name (required)
- Category
- Brand
- Preferred store
- Default quantity and unit
- Capacity/size and capacity unit, such as `300 g`
- Default price and currency
- Notes

Master items support autocomplete and can be reused on future lists.

### Shopping-list item

An item currently planned for purchase. Adding a master item to a list creates a snapshot/copy of its relevant attributes. The snapshot is independent: later edits to the master item do not silently change an existing list item.

Users can also start with a new name; the application may create a master item and add its snapshot to the list.

### Cart and cart item

Checking a shopping-list item immediately creates a cart and cart-item record (or adds it to the list’s active cart). The cart item contains the actual purchase candidate and can override copied attributes such as quantity, capacity, store, or expected price.

The list item should retain enough status/history to show that it was moved to a cart and avoid accidental duplicate cart entries.

### Checkout and purchase history

Checkout is a separate explicit action. It creates a purchase record and purchase-item records from the cart. Purchase records capture actual results, including store, purchase date, actual price, currency, quantity, capacity, and optional notes. Checkout must preserve historical values even if the master item changes later.

## 4. Main workflows

### Create and share a list

1. User creates a named shopping list inside a household.
2. Owner invites another registered user.
3. Members see the same list and its current state according to their role.

### Add an item

1. User focuses the quick-add field.
2. Existing master items are suggested as the user types.
3. Selecting a suggestion copies the master item into the shopping list.
4. A new name creates a master item and its list-item snapshot, subject to normal validation.
5. Optional attributes can be entered or edited on the list item.

### Buy an item

1. User checks the list item.
2. The application immediately creates or updates the active cart and cart item.
3. User can adjust actual quantity, capacity, store, price, and notes in the cart.
4. User checks out the cart, creating immutable purchase history records.

### Rebuy from history

From a master item or purchase history, the user can add the item to a selected future shopping list. The new list item is another snapshot and does not alter previous records.

## 5. Stores

Users can create and reuse stores. A store can represent either a local market or an online market and may include optional:

- Name
- Type: local or online
- Address
- Website or ordering URL
- Notes

Store information is reusable, while purchase-specific values remain on the purchase record.

## 6. Initial screens

- Sign in / sign up / account callback
- Household and member management
- Shopping-list index
- Shopping-list detail with fast add, autocomplete, filters, and check-off interaction
- Cart detail and checkout
- Purchase history with item/store/date/price filters
- Master-item catalog and detail/edit view
- Store catalog and detail/edit view

## 7. Non-functional requirements

- Responsive mobile-first UI usable on iPhone Safari and desktop browsers.
- PWA installability; offline data mutation is explicitly out of scope for the first release.
- All application data is tenant-scoped through household membership checks.
- Monetary values must avoid floating-point storage; store minor units or PostgreSQL `numeric` values with explicit currency.
- Timestamps are stored in UTC and displayed using the user/household timezone, defaulting to `Asia/Seoul`.
- Default locale is English and default currency is `KRW`, both configurable later.
