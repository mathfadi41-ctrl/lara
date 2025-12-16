-- CreateEnum
CREATE TYPE "StreamType" AS ENUM ('COLOR', 'THERMAL', 'SPLIT');

-- CreateEnum
CREATE TYPE "SplitLayout" AS ENUM ('LEFT_RIGHT', 'TOP_BOTTOM');

-- CreateEnum
CREATE TYPE "DetectionType" AS ENUM ('SMOKE', 'FIRE', 'HOTSPOT');

-- AlterTable
ALTER TABLE "streams" ADD COLUMN "type" "StreamType" NOT NULL DEFAULT 'COLOR',
ADD COLUMN "splitLayout" "SplitLayout";

-- AlterTable
ALTER TABLE "detections" ADD COLUMN "detectionType" "DetectionType" NOT NULL DEFAULT 'SMOKE';

-- Backfill existing data
-- All existing streams default to COLOR (already handled by column default)
-- Map existing detection labels to detection types
UPDATE "detections" 
SET "detectionType" = CASE 
  WHEN LOWER(label) LIKE '%fire%' THEN 'FIRE'::​"DetectionType"
  WHEN LOWER(label) LIKE '%hotspot%' THEN 'HOTSPOT'::​"DetectionType"
  WHEN LOWER(label) LIKE '%smoke%' THEN 'SMOKE'::​"DetectionType"
  ELSE 'SMOKE'::​"DetectionType"
END;
