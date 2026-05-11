-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Backfill: existing users are considered onboarded already
UPDATE "UserProfile" SET "onboardingCompletedAt" = "createdAt" WHERE "onboardingCompletedAt" IS NULL;
