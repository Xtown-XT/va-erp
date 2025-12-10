import express from "express";
import serviceController from "./service.controller.js";

const router = express.Router();

router.post("/", serviceController.createServiceEntry); // Alias for legacy/direct calls
router.post("/entry", serviceController.createServiceEntry);
router.get("/history", serviceController.getServiceHistory);
router.get("/notifications", serviceController.getNotifications);
router.get("/alerts", serviceController.getServiceAlerts);

export default router;
