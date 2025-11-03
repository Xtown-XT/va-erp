-- Migration: Make phone and email columns nullable in address table
-- Date: 2024
-- Description: Update phone and email columns to allow NULL values to make them optional

-- Make phone column nullable
ALTER TABLE `address` MODIFY COLUMN `phone` VARCHAR(255) NULL;

-- Make email column nullable
ALTER TABLE `address` MODIFY COLUMN `email` VARCHAR(255) NULL;

-- Verify the columns are now nullable
-- DESCRIBE address;

