-- The item attribute tables are now the sole source of truth for item details.
ALTER TABLE "master_items" DROP CONSTRAINT IF EXISTS "master_items_preferred_store_id_fkey";
ALTER TABLE "master_items" DROP COLUMN IF EXISTS "category";
ALTER TABLE "master_items" DROP COLUMN IF EXISTS "brand";
ALTER TABLE "master_items" DROP COLUMN IF EXISTS "default_quantity";
ALTER TABLE "master_items" DROP COLUMN IF EXISTS "default_unit";
ALTER TABLE "master_items" DROP COLUMN IF EXISTS "capacity";
ALTER TABLE "master_items" DROP COLUMN IF EXISTS "capacity_unit";
ALTER TABLE "master_items" DROP COLUMN IF EXISTS "default_price";
ALTER TABLE "master_items" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "master_items" DROP COLUMN IF EXISTS "notes";
ALTER TABLE "master_items" DROP COLUMN IF EXISTS "preferred_store_id";

ALTER TABLE "shopping_list_items" DROP COLUMN IF EXISTS "brand";
ALTER TABLE "shopping_list_items" DROP COLUMN IF EXISTS "quantity";
ALTER TABLE "shopping_list_items" DROP COLUMN IF EXISTS "unit";
ALTER TABLE "shopping_list_items" DROP COLUMN IF EXISTS "capacity";
ALTER TABLE "shopping_list_items" DROP COLUMN IF EXISTS "capacity_unit";
ALTER TABLE "shopping_list_items" DROP COLUMN IF EXISTS "expected_price";
ALTER TABLE "shopping_list_items" DROP COLUMN IF EXISTS "notes";

ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "quantity";
ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "unit";
ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "capacity";
ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "capacity_unit";
ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "expected_price";
ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "notes";

ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "quantity";
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "unit";
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "capacity";
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "capacity_unit";
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "actual_price";
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "notes";
