CREATE TABLE "household_invitations" (
  "id" UUID NOT NULL,
  "household_id" UUID NOT NULL,
  "invited_by_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" "member_role" NOT NULL DEFAULT 'editor',
  "token" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "household_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "household_invitations_token_key" ON "household_invitations"("token");
CREATE INDEX "household_invitations_email_accepted_at_idx" ON "household_invitations"("email", "accepted_at");
ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
