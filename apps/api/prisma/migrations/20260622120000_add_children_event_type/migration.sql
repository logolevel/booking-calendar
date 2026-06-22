-- Add 'children' to EventType enum and adultsCount column to Event.
-- Postgres does not support ADD VALUE inside a transaction, so this runs
-- outside one (Prisma will wrap the rest but enum additions are always DDL).
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'children';

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "adultsCount" INTEGER;
