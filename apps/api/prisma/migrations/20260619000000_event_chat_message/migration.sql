-- CreateTable
CREATE TABLE "EventChatMessage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventChatMessage_eventId_userId_key" ON "EventChatMessage"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventChatMessage_eventId_idx" ON "EventChatMessage"("eventId");

-- AddForeignKey
ALTER TABLE "EventChatMessage" ADD CONSTRAINT "EventChatMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
