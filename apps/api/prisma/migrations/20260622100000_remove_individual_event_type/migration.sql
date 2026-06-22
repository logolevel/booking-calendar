-- Convert any existing 'individual' events to 'mixed' before dropping the value.
UPDATE "Event" SET "type" = 'mixed' WHERE "type" = 'individual';

-- Postgres does not support DROP VALUE on an enum directly.
-- Recreate the enum without 'individual' using the standard rename-create-swap pattern.
ALTER TYPE "EventType" RENAME TO "EventType_old";

CREATE TYPE "EventType" AS ENUM ('women', 'men', 'mixed', 'tech_women', 'tech_men', 'group');

ALTER TABLE "Event" ALTER COLUMN "type" TYPE "EventType" USING "type"::text::"EventType";

DROP TYPE "EventType_old";
