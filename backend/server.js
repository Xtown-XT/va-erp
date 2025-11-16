import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import os from "os";
import authRoutes from "./src/modules/auth/auth.routes.js";
import { authenticate } from "./src/shared/middlewares/auth.js";
import { connectDB } from "./src/config/db.js";
import sequelize from "./src/config/db.js";
import { apiLimiter } from "./src/shared/middlewares/rateLimit.js";
import { seedAdminUser } from "./src/shared/seedAdmin.js";
import { notFound } from "./src/shared/middlewares/notFound.js";
import { errorHandler } from "./src/shared/middlewares/errorHandler.js";
import {
  employeeListRoutes,
  employeeAttendanceRoutes,
} from "./src/modules/employee/index.js";
import { brandRoutes } from "./src/modules/brand/index.js";
import { dailyEntryRoutes } from "./src/modules/dailyEntry/index.js";
import { itemRoutes } from "./src/modules/item/index.js";
import { itemServiceRoutes } from "./src/modules/itemService/index.js";
import { poRoutes } from "./src/modules/po/index.js";
import { poItemRoutes } from "./src/modules/poItem/index.js";
import { serviceRoutes } from "./src/modules/service/index.js";
import serviceAlertsRoutes from "./src/modules/service/serviceAlerts.routes.js";
import { siteRoutes } from "./src/modules/site/index.js";
import { supplierRoutes } from "./src/modules/supplier/index.js";
import { machineRoutes } from "./src/modules/vehicle/index.js"; // Changed from vehicleRoutes
import { compressorRoutes } from "./src/modules/compressor/index.js";
import { userRoutes } from "./src/modules/user/index.js";
import { addressRoutes } from "./src/modules/address/index.js";
import stockTransactionRoutes from "./src/modules/stockTransaction/stockTransaction.routes.js";
import { defineAssociations } from "./src/shared/models/associations.js";
import Service from "./src/modules/service/service.model.js";
import ItemService from "./src/modules/itemService/itemService.model.js";
import DailyEntryEmployee from "./src/modules/dailyEntry/dailyEntryEmployee.model.js";
import DailyEntry from "./src/modules/dailyEntry/dailyEntry.model.js";
import Compressor from "./src/modules/compressor/compressor.model.js";
import Address from "./src/modules/address/address.model.js";

const app = express();

dotenv.config();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));
app.use("/api", apiLimiter);


// Connect DB
// const initializeDatabase = async () => {
//   try {
//     await connectDB(); // connect only
//     defineAssociations(); // define relationships

//     console.log(Object.keys(sequelize.models));

//     await sequelize.sync({ force: false, alter: true }); // now sync with associations
//     await seedAdminUser();
//     console.log("✅ Database initialized successfully with associations");
//   } catch (error) {
//     console.error("❌ Database initialization failed:", error);
//     process.exit(1);
//   }
// };

// Replace your initializeDatabase function in server.js with this:

// Replace your initializeDatabase function in server.js with this:

const initializeDatabase = async () => {
  try {
 
    await connectDB();

    defineAssociations();
   
    // Sync all tables without alter (to avoid conflicts with existing tables)
    await sequelize.sync({ force: false, alter: false, logging: false });
    
    // Manually sync/alter specific tables that need updates
    console.log("🔄 Syncing tables with latest schema...");
    try {
      // Sync DailyEntry tables (create if doesn't exist, alter if exists)
      // Sync DailyEntryEmployee first (has foreign key to DailyEntry)
      await DailyEntryEmployee.sync({ alter: true, logging: false });
      console.log("✅ DailyEntryEmployee table synced");
      
      // Sync DailyEntry table (will create if dropped)
      await DailyEntry.sync({ alter: true, logging: false });
      console.log("✅ DailyEntry table synced");
      
      // Sync ItemService table (new)
      await ItemService.sync({ alter: true, logging: false });
      console.log("✅ ItemService table synced");
      
      // Alter Service table to add serviceName column
      await Service.sync({ alter: true, logging: false });
      console.log("✅ Service table columns updated");
      
      // Alter Compressor table to sync schema changes
      await Compressor.sync({ alter: true, logging: false });
      console.log("✅ Compressor table columns updated");
      
      // Alter Address table to allow null phone/email columns
      await Address.sync({ alter: true, logging: false });
      console.log("✅ Address table columns updated");
    } catch (alterError) {
      console.log("⚠️  Warning: Some table alterations failed (columns may already exist):", alterError.message);
      // Continue even if alter fails - columns might already exist
    }
    
    await seedAdminUser();
    console.log("✅ Step 4: Admin user seeded");

    console.log("✅ Database initialized successfully with associations");
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
};

// Initialize database before setting up routes
await initializeDatabase();

app.get("/health", (req, res) => {
  res.send(`server is running and healthy ;)`);
});

// routes without auth  (/api/auth/login)
app.use("/api/auth", authRoutes);

const protectedRoutes = express.Router();

// Mount all module routes on protected routes

// Employee routes
protectedRoutes.use("/employeeLists", employeeListRoutes);
protectedRoutes.use("/employeeAttendance", employeeAttendanceRoutes);

// Brand routes
protectedRoutes.use("/brands", brandRoutes);

// Daily Entry routes
protectedRoutes.use("/dailyEntries", dailyEntryRoutes);

// Item routes
protectedRoutes.use("/items", itemRoutes);
protectedRoutes.use("/itemServices", itemServiceRoutes);

// Purchase Order routes
protectedRoutes.use("/pos", poRoutes);
protectedRoutes.use("/poItems", poItemRoutes);

// Service routes (deprecated, but kept for backward compatibility)
protectedRoutes.use("/services", serviceRoutes);
protectedRoutes.use("/service-alerts", serviceAlertsRoutes);

// Site routes
protectedRoutes.use("/sites", siteRoutes);

// Supplier routes
protectedRoutes.use("/suppliers", supplierRoutes);

//address routes
protectedRoutes.use("/address", addressRoutes);

// Machine routes (kept /vehicles path for backward compatibility)
protectedRoutes.use("/vehicles", machineRoutes); // Changed from vehicleRoutes

// Compressor routes
protectedRoutes.use("/compressors", compressorRoutes);

// User Management routes (Admin only)
protectedRoutes.use("/users", userRoutes);

// Stock Transaction routes
protectedRoutes.use("/stockTransactions", stockTransactionRoutes);


// Item Instance routes

// Now apply auth + mount once
app.use("/api", authenticate, protectedRoutes);

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "0.0.0.0";
}

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

app.listen(PORT, `0.0.0.0`, () => {
  try {
    const ip = getLocalIp();
    console.log(`
        
        server is running:  http://localhost:${PORT}
                            http://${ip}:${PORT} 
    `);
  } catch (err) {
    console.log(`error in running server ${err}`);
  }
});
