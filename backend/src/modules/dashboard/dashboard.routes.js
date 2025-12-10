import { Router } from "express";
import { DashboardController } from "./dashboard.controller.js";
import { authorize } from "../../shared/middlewares/auth.js";

const router = Router();

router.get("/stats", authorize("read"), DashboardController.getStats);

export default router;
