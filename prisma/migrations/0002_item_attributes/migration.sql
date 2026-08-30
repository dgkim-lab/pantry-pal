-- Attribute tables may already exist in databases created from the amended
-- initial migration. IF NOT EXISTS keeps this forward migration safe there.
DO $$ BEGIN
  CREATE TYPE "attribute_value_type" AS ENUM ('text', 'number', 'boolean');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "master_item_attributes" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "master_item_id" UUID NOT NULL, "attribute_key" TEXT NOT NULL, "value" TEXT NOT NULL, "value_type" "attribute_value_type" NOT NULL DEFAULT 'text', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "master_item_attributes_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "shopping_list_item_attributes" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "shopping_list_item_id" UUID NOT NULL, "attribute_key" TEXT NOT NULL, "value" TEXT NOT NULL, "value_type" "attribute_value_type" NOT NULL DEFAULT 'text', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "shopping_list_item_attributes_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "cart_item_attributes" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "cart_item_id" UUID NOT NULL, "attribute_key" TEXT NOT NULL, "value" TEXT NOT NULL, "value_type" "attribute_value_type" NOT NULL DEFAULT 'text', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "cart_item_attributes_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "purchase_item_attributes" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "purchase_item_id" UUID NOT NULL, "attribute_key" TEXT NOT NULL, "value" TEXT NOT NULL, "value_type" "attribute_value_type" NOT NULL DEFAULT 'text', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "purchase_item_attributes_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "master_item_attributes_master_item_id_attribute_key_key" ON "master_item_attributes"("master_item_id", "attribute_key");
CREATE UNIQUE INDEX IF NOT EXISTS "shopping_list_item_attributes_shopping_list_item_id_attribute_key_key" ON "shopping_list_item_attributes"("shopping_list_item_id", "attribute_key");
CREATE UNIQUE INDEX IF NOT EXISTS "cart_item_attributes_cart_item_id_attribute_key_key" ON "cart_item_attributes"("cart_item_id", "attribute_key");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_item_attributes_purchase_item_id_attribute_key_key" ON "purchase_item_attributes"("purchase_item_id", "attribute_key");
ALTER TABLE "master_item_attributes" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "shopping_list_item_attributes" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "cart_item_attributes" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "purchase_item_attributes" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

INSERT INTO "master_item_attributes" ("master_item_id", "attribute_key", "value", "value_type")
SELECT "id", key, value, type::"attribute_value_type" FROM "master_items" m CROSS JOIN LATERAL (VALUES
  ('category', m."category", 'text'), ('brand', m."brand", 'text'), ('default_quantity', m."default_quantity"::text, 'number'), ('default_unit', m."default_unit", 'text'), ('capacity', m."capacity"::text, 'number'), ('capacity_unit', m."capacity_unit", 'text'), ('default_price', m."default_price"::text, 'number'), ('currency', m."currency", 'text'), ('notes', m."notes", 'text'), ('preferred_store_id', m."preferred_store_id"::text, 'text')
) AS attrs(key, value, type) WHERE value IS NOT NULL ON CONFLICT ("master_item_id", "attribute_key") DO NOTHING;

INSERT INTO "shopping_list_item_attributes" ("shopping_list_item_id", "attribute_key", "value", "value_type")
SELECT "id", key, value, type::"attribute_value_type" FROM "shopping_list_items" m CROSS JOIN LATERAL (VALUES
  ('brand', m."brand", 'text'), ('quantity', m."quantity"::text, 'number'), ('unit', m."unit", 'text'), ('capacity', m."capacity"::text, 'number'), ('capacity_unit', m."capacity_unit", 'text'), ('expected_price', m."expected_price"::text, 'number'), ('notes', m."notes", 'text')
) AS attrs(key, value, type) WHERE value IS NOT NULL ON CONFLICT ("shopping_list_item_id", "attribute_key") DO NOTHING;

INSERT INTO "cart_item_attributes" ("cart_item_id", "attribute_key", "value", "value_type")
SELECT "id", key, value, type::"attribute_value_type" FROM "cart_items" m CROSS JOIN LATERAL (VALUES
  ('quantity', m."quantity"::text, 'number'), ('unit', m."unit", 'text'), ('capacity', m."capacity"::text, 'number'), ('capacity_unit', m."capacity_unit", 'text'), ('expected_price', m."expected_price"::text, 'number'), ('currency', m."currency", 'text'), ('notes', m."notes", 'text')
) AS attrs(key, value, type) WHERE value IS NOT NULL ON CONFLICT ("cart_item_id", "attribute_key") DO NOTHING;

INSERT INTO "purchase_item_attributes" ("purchase_item_id", "attribute_key", "value", "value_type")
SELECT "id", key, value, type::"attribute_value_type" FROM "purchase_items" m CROSS JOIN LATERAL (VALUES
  ('quantity', m."quantity"::text, 'number'), ('unit', m."unit", 'text'), ('capacity', m."capacity"::text, 'number'), ('capacity_unit', m."capacity_unit", 'text'), ('actual_price', m."actual_price"::text, 'number'), ('currency', m."currency", 'text'), ('notes', m."notes", 'text')
) AS attrs(key, value, type) WHERE value IS NOT NULL ON CONFLICT ("purchase_item_id", "attribute_key") DO NOTHING;
