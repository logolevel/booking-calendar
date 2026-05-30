-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('women', 'men', 'mixed', 'individual', 'tech_women', 'tech_men');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "resourceId" INTEGER NOT NULL,
ADD COLUMN     "type" "EventType" NOT NULL,
ALTER COLUMN "title" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
