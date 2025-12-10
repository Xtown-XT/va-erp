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
// import { seedAdminUser } from "./src/shared/seedAdmin.js";
import { notFound } from "./src/shared/middlewares/notFound.js";
import { errorHandler } from "./src/shared/middlewares/errorHandler.js";
import {
  employeeListRoutes,
  employeeAttendanceRoutes,
} from "./src/modules/employee/index.js";
import { brandRoutes } from "./src/modules/brand/index.js";
import { dailyEntryRoutes } from "./src/modules/dailyEntry/index.js";

import { siteRoutes } from "./src/modules/site/index.js";
import { supplierRoutes } from "./src/modules/supplier/index.js";
import { machineRoutes } from "./src/modules/machine/index.js";
import { compressorRoutes } from "./src/modules/compressor/index.js";
import { userRoutes } from "./src/modules/user/index.js";
import { addressRoutes } from "./src/modules/address/index.js";
import { sparesRoutes } from "./src/modules/spares/index.js";
import { drillingToolsRoutes } from "./src/modules/drillingTools/index.js";
import { inventoryRoutes } from "./src/modules/inventory/index.js";
import itemRoutes from "./src/modules/item/item.routes.js";
import { purchaseOrderRoutes } from "./src/modules/inventory/index.js";
import { serviceRoutes } from "./src/modules/service/index.js";
import reportsRoutes from "./src/modules/inventory/reports.routes.js";

import { defineAssociations } from "./src/shared/models/associations.js";

import DailyEntryEmployee from "./src/modules/dailyEntry/dailyEntryEmployee.model.js";
import DailyEntry from "./src/modules/dailyEntry/dailyEntry.model.js";
import Compressor from "./src/modules/compressor/compressor.model.js";
import Address from "./src/modules/address/address.model.js";
import Spares from "./src/modules/spares/spares.model.js";
import DrillingTools from "./src/modules/drillingTools/drillingTools.model.js";
import Purchase from "./src/modules/inventory/models/purchase.model.js";
import SiteStock from "./src/modules/inventory/models/siteStock.model.js";

const app = express();

dotenv.config();

const PORT = process.env.PORT || 5000;

// Body parser MUST come first
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Allow localhost and the production frontend URL
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      'https://va-erp-backend.onrender.com',
      'https://va-erp.xtown.in'
    ];

    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now - can be restricted later
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));
app.use("/api", apiLimiter);


// Connect DB
const initializeDatabase = async () => {
  try {

    await connectDB();

    defineAssociations();

    await sequelize.sync({ alter: true }); // Sync with schema alterations enabled
    // await sequelize.sync(); // Disabled simple sync
    console.log("✅ Database synced");

    // await seedAdminUser(); // Removed as per request (use seed_admin.md)

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

// Site routes
protectedRoutes.use("/sites", siteRoutes);

// Supplier routes
protectedRoutes.use("/suppliers", supplierRoutes);

// Address routes
protectedRoutes.use("/address", addressRoutes);

// Machine routes
protectedRoutes.use("/machines", machineRoutes);

// Compressor routes
protectedRoutes.use("/compressors", compressorRoutes);

// User Management routes (Admin only)
protectedRoutes.use("/users", userRoutes);

// Spares routes
protectedRoutes.use("/spares", sparesRoutes);
protectedRoutes.use("/drilling-tools", drillingToolsRoutes);
protectedRoutes.use("/inventory", inventoryRoutes);
protectedRoutes.use("/items", itemRoutes);
protectedRoutes.use("/purchase-orders", purchaseOrderRoutes);
protectedRoutes.use("/service", serviceRoutes);
protectedRoutes.use("/reports", reportsRoutes);
import dashboardRoutes from "./src/modules/dashboard/dashboard.routes.js";
protectedRoutes.use("/dashboard", dashboardRoutes);

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
