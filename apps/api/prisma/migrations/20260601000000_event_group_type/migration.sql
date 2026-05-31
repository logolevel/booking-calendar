-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'group';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "organizerName" TEXT,
ADD COLUMN     "organizerPhone" TEXT;
