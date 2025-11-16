import { Router } from "express";
import { ItemServiceController } from "./itemService.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { authorize } from "../../shared/middlewares/auth.js";
import {
  fitItemSchema,
  removeItemSchema,
} from "./itemService.zod.js";

const router = Router();

// Get fitted items (with optional filters)
router.get("/fitted", authorize("read"), ItemServiceController.getFitted);

// Get fitted items by machine
router.get(
  "/by-machine/:vehicleId",
  authorize("read"),
  ItemServiceController.getByMachine
);

// Get fitted items by compressor
router.get(
  "/by-compressor/:compressorId",
  authorize("read"),
  ItemServiceController.getByCompressor
);

// Fit an item
router.post(
  "/fit",
  authorize("create"),
  validate(fitItemSchema),
  ItemServiceController.fit
);

// Remove a fitted item
router.put(
  "/:id/remove",
  authorize("update"),
  validate(removeItemSchema),
  ItemServiceController.remove
);

// Get usage report
router.get("/usage-report", authorize("read"), ItemServiceController.getUsageReport);

// Standard CRUD operations
router.get("/", authorize("read"), ItemServiceController.getAll);
router.get("/:id", authorize("read"), ItemServiceController.getById);
router.delete("/:id", authorize("delete"), ItemServiceController.softDelete);

export default router;

