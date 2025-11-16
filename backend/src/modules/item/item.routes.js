import { Router } from "express";
import { ItemController } from "./item.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { authorize } from "../../shared/middlewares/auth.js";
import {
  createItemSchema,
  updateItemSchema,
  deleteItemSchema,
} from "./item.zod.js";

const router = Router();

// New endpoints first (before parameterized routes)
router.post("/initialize-month", authorize("update"), ItemController.initializeMonth);
router.get("/monthly-report", authorize("read"), ItemController.getMonthlyReport);
router.get("/by-type/:itemType", authorize("read"), ItemController.getByType);
router.get("/available-for-service", authorize("read"), ItemController.getAvailableForService);
router.get("/available-for-fitting", authorize("read"), ItemController.getAvailableForService); // Alias for backward compatibility

// Standard CRUD
router.post(
  "/",
  authorize("create"),
  validate(createItemSchema),
  ItemController.create
);
router.get("/", authorize("read"), ItemController.getAll);
router.get("/:id", authorize("read"), ItemController.getById);
router.put(
  "/:id",
  authorize("update"),
  validate(updateItemSchema),
  ItemController.update
);
router.delete(
  "/:id",
  authorize("delete"),
  validate(deleteItemSchema),
  ItemController.softDelete
);
router.delete("/:id/hard", authorize("delete"), ItemController.hardDelete);
router.post("/:id/restore", authorize("update"), ItemController.restore);

export default router;
