-- Migration: Remove compressorType column from compressor table
-- Date: 2024
-- Description: This column was removed from the model/schema but may still exist in the database

-- First, check if the column exists (optional - run this first to verify)
-- SHOW COLUMNS FROM compressor LIKE 'compressorType';

-- Remove the compressorType column
ALTER TABLE `compressor` DROP COLUMN IF EXISTS `compressorType`;

-- Alternative: If DROP COLUMN IF EXISTS doesn't work (older MySQL versions), use:
-- ALTER TABLE `compressor` DROP COLUMN `compressorType`;

-- Verify the column was removed
-- DESCRIBE compressor;

