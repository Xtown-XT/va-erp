import { Router } from "express";
import { InventoryController } from "./inventory.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { authorize } from "../../shared/middlewares/auth.js";
import { createPurchaseSchema, updateSiteStockSchema } from "./inventory.zod.js";

const router = Router();

// Purchases
router.post("/purchases", authorize("create"), validate(createPurchaseSchema), InventoryController.createPurchase);
router.get("/purchases", authorize("read"), InventoryController.getAllPurchases);

// Stock
router.get("/stock", authorize("read"), InventoryController.getSiteStock);
router.get("/stock/sitewise", authorize("read"), InventoryController.getSiteWiseStock);
router.post("/stock/update", authorize("update"), validate(updateSiteStockSchema), InventoryController.updateStock);
router.post("/manual-stock", authorize("update"), InventoryController.updateStock); // Helper for manual
router.get("/reports/stock", authorize("read"), InventoryController.getStockReport);

export default router;
