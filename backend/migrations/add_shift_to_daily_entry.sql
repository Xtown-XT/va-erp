-- Migration: Add shift field to dailyEntry table
-- Date: 2025-11-09

-- Add shift column with default value 1 for existing records
ALTER TABLE "dailyEntry" 
ADD COLUMN "shift" INTEGER NOT NULL DEFAULT 1 
CHECK ("shift" IN (1, 2));

-- Add comment to describe the column
COMMENT ON COLUMN "dailyEntry"."shift" IS 'Shift number (1 or 2) for this daily entry';

