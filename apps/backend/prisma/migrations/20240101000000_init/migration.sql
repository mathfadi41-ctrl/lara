-- CreateEnum
CREATE TYPE "StreamStatus" AS ENUM ('STOPPED', 'STARTING', 'RUNNING', 'ERROR', 'STOPPING');

-- CreateTable
CREATE TABLE "streams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rtspUrl" TEXT NOT NULL,
    "status" "StreamStatus" NOT NULL DEFAULT 'STOPPED',
    "detectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fps" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastHeartbeat" TIMESTAMP(3),

    CONSTRAINT "streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detections" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "boundingBox" JSONB NOT NULL,
    "imagePath" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "streams_status_idx" ON "streams"("status");

-- CreateIndex
CREATE INDEX "detections_streamId_timestamp_idx" ON "detections"("streamId", "timestamp");

-- CreateIndex
CREATE INDEX "detections_timestamp_idx" ON "detections"("timestamp");

-- AddForeignKey
ALTER TABLE "detections" ADD CONSTRAINT "detections_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
