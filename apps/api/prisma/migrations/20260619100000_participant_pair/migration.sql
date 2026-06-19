-- AlterTable
ALTER TABLE "EventParticipant" ADD COLUMN "pairId" TEXT;

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_pairId_idx" ON "EventParticipant"("eventId", "pairId");
