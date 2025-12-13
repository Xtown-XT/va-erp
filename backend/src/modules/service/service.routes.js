import express from "express";
import alertsController from "./alerts.controller.js";
import serviceController from "./service.controller.js";

const router = express.Router();

router.post("/", serviceController.createServiceEntry);
router.post("/entry", serviceController.createServiceEntry);
router.get("/history", serviceController.getServiceHistory);
router.get("/notifications", serviceController.getNotifications);
router.get("/alerts", alertsController.getServiceAlerts);
router.get("/maintenance-status/:type/:id", serviceController.getMaintenanceStatus);

export default router;
