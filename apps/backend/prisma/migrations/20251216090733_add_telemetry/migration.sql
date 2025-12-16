/*
  Warnings:

  - You are about to drop the `Detection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Stream` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TelemetrySource" AS ENUM ('MAVLINK', 'SIMULATOR', 'MANUAL');

-- DropForeignKey
ALTER TABLE "Detection" DROP CONSTRAINT "Detection_streamId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropTable
DROP TABLE "Detection";

-- DropTable
DROP TABLE "RefreshToken";

-- DropTable
DROP TABLE "Stream";

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "telemetry" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitude" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL,
    "roll" DOUBLE PRECISION NOT NULL,
    "pitch" DOUBLE PRECISION NOT NULL,
    "yaw" DOUBLE PRECISION NOT NULL,
    "source" "TelemetrySource" NOT NULL DEFAULT 'SIMULATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telemetry_streamId_createdAt_idx" ON "telemetry"("streamId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "telemetry" ADD CONSTRAINT "telemetry_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
