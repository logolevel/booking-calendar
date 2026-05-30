-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'member', 'external');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isAdmin",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE "ExternalAccess" (
    "telegramId" BIGINT NOT NULL,
    "grantedBy" BIGINT NOT NULL,
    "accessRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalAccess_pkey" PRIMARY KEY ("telegramId")
);
