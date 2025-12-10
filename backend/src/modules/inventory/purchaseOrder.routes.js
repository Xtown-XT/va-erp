import express from "express";
import purchaseOrderController from "./purchaseOrder.controller.js";

const router = express.Router();

router.get("/generate-ref", purchaseOrderController.generatePOReference); // Must be before /:id
router.get("/", purchaseOrderController.getAllPOs);
router.post("/", purchaseOrderController.createPO);
router.get("/:id", purchaseOrderController.getPOById);
router.delete("/:id", purchaseOrderController.deletePO);
router.post("/:id/receive", purchaseOrderController.receivePO);

export default router;
