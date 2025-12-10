import { Router } from "express";
import reportsController from "./reports.controller.js";
import { authorize } from "../../shared/middlewares/auth.js";

const router = Router();

router.get("/spares-summary", authorize("read"), reportsController.sparesSummary);
router.get("/spares-usage-log", authorize("read"), reportsController.sparesUsageLog);
router.get("/production-sitewise", authorize("read"), reportsController.productionSitewise);
router.get("/production-machinewise", authorize("read"), reportsController.productionMachinewise);

export default router;
