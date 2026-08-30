DROP INDEX IF EXISTS "carts_list_id_status_key";

CREATE UNIQUE INDEX "carts_active_list_id_key"
ON "carts" ("list_id")
WHERE "status" = 'active';
