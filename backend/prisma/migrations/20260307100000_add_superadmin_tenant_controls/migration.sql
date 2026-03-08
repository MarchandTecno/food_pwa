-- AlterTable
ALTER TABLE "public"."branches"
ADD COLUMN "is_suspended" BOOLEAN DEFAULT false,
ADD COLUMN "suspension_reason" TEXT;

-- AlterTable
ALTER TABLE "public"."tenants"
ADD COLUMN "brand_palette" JSONB,
ADD COLUMN "region_code" VARCHAR(10),
ADD COLUMN "time_zone" VARCHAR(64) DEFAULT 'UTC',
ADD COLUMN "subscription_status" VARCHAR(20) DEFAULT 'ACTIVE',
ADD COLUMN "subscription_note" TEXT,
ADD COLUMN "subscription_updated_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "tenants_subscription_status_idx" ON "public"."tenants"("subscription_status");
