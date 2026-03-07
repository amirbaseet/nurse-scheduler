-- ClinicDefaultConfig: add canSplit and minSplitHours
ALTER TABLE "ClinicDefaultConfig" ADD COLUMN "canSplit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClinicDefaultConfig" ADD COLUMN "minSplitHours" DOUBLE PRECISION NOT NULL DEFAULT 3.0;

-- ClinicWeeklyConfig: add canSplit and minSplitHours (nullable for weekly override)
ALTER TABLE "ClinicWeeklyConfig" ADD COLUMN "canSplit" BOOLEAN;
ALTER TABLE "ClinicWeeklyConfig" ADD COLUMN "minSplitHours" DOUBLE PRECISION;
