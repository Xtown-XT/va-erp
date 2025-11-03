/**
 * Migration script to drop and recreate dailyEntry and dailyEntryEmployee tables
 * 
 * WARNING: This will DELETE ALL existing daily entry data!
 * 
 * Usage:
 *   node backend/migrations/dropAndRecreateDailyEntry.js
 * 
 * Or from project root:
 *   cd backend && node migrations/dropAndRecreateDailyEntry.js
 */

import dotenv from "dotenv";
import { Sequelize } from "sequelize";

// Load environment variables
dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "mysql",
    logging: console.log, // Show SQL queries
  }
);

const dropTables = async () => {
  try {
    console.log("🔌 Connecting to database...");
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    console.log("\n⚠️  WARNING: This will DELETE ALL daily entry data!");
    console.log("Dropping tables: dailyEntryEmployee, dailyEntry\n");

    // Disable foreign key checks
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

    // Drop dailyEntryEmployee table first (has foreign key to dailyEntry)
    try {
      await sequelize.query("DROP TABLE IF EXISTS `dailyEntryEmployee`");
      console.log("✅ Dropped dailyEntryEmployee table");
    } catch (error) {
      console.log("⚠️  dailyEntryEmployee table may not exist:", error.message);
    }

    // Drop dailyEntry table
    try {
      await sequelize.query("DROP TABLE IF EXISTS `dailyEntry`");
      console.log("✅ Dropped dailyEntry table");
    } catch (error) {
      console.log("⚠️  dailyEntry table may not exist:", error.message);
    }

    // Re-enable foreign key checks
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("\n✅ Tables dropped successfully!");
    console.log("📝 Next steps:");
    console.log("   1. Restart your backend server");
    console.log("   2. The tables will be automatically recreated with the new schema");
    console.log("   3. The employeeId field will now be optional\n");

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error dropping tables:", error.message);
    console.error("Full error:", error);
    await sequelize.close();
    process.exit(1);
  }
};

// Run the migration
dropTables();

