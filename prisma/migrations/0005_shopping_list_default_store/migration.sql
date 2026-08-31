ALTER TABLE "shopping_lists"
ADD COLUMN "default_store_id" UUID;

CREATE INDEX "shopping_lists_default_store_id_idx"
ON "shopping_lists"("default_store_id");

ALTER TABLE "shopping_lists"
ADD CONSTRAINT "shopping_lists_default_store_id_fkey"
FOREIGN KEY ("default_store_id") REFERENCES "stores"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
