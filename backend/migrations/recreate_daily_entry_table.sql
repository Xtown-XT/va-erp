-- =============================================================================
-- Migration Script: Drop and Recreate Daily Entry Tables
-- =============================================================================
-- 
-- WARNING: This will DELETE ALL existing daily entry data!
-- This includes all dailyEntry and dailyEntryEmployee records.
--
-- =============================================================================
-- INSTRUCTIONS:
-- =============================================================================
-- 
-- OPTION 1: Use Node.js Script (Recommended)
--   From project root:
--     node backend/migrations/dropAndRecreateDailyEntry.js
-- 
--   Or from backend directory:
--     cd backend
--     node migrations/dropAndRecreateDailyEntry.js
--
-- OPTION 2: Run SQL Script Manually
--   1. Connect to your MySQL database using a client (phpMyAdmin, MySQL Workbench, etc.)
--   2. Select your database
--   3. Execute this entire SQL script
--   4. Restart your backend server
--
-- =============================================================================
-- After running this script:
-- =============================================================================
-- 1. Restart your backend server (npm start or node server.js)
-- 2. Sequelize will automatically recreate the tables with the new schema
-- 3. The employeeId field will now be optional (allowNull: true)
-- 4. All form fields will match the database schema
--
-- =============================================================================

-- Disable foreign key checks to allow dropping tables with foreign keys
SET FOREIGN_KEY_CHECKS = 0;

-- Drop the dailyEntryEmployee table first (has foreign key to dailyEntry)
DROP TABLE IF EXISTS `dailyEntryEmployee`;

-- Drop the dailyEntry table
DROP TABLE IF EXISTS `dailyEntry`;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- Done! Now restart your backend server to recreate the tables.
-- =============================================================================

