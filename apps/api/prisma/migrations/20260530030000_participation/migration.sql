-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" BIGINT,
    "guestName" TEXT,
    "addedByUserId" BIGINT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventWaitlist" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipationLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actorUserId" BIGINT NOT NULL,
    "targetUserId" BIGINT,
    "targetGuestName" TEXT,
    "action" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventParticipationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_idx" ON "EventParticipant"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_userId_key" ON "EventParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventWaitlist_eventId_createdAt_idx" ON "EventWaitlist"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventWaitlist_eventId_userId_key" ON "EventWaitlist"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventParticipationLog_eventId_at_idx" ON "EventParticipationLog"("eventId", "at");

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventWaitlist" ADD CONSTRAINT "EventWaitlist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipationLog" ADD CONSTRAINT "EventParticipationLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
