import { Router } from "express";
import { ItemController } from "./item.controller.js";
import { authorize } from "../../shared/middlewares/auth.js";

const router = Router();

router.get("/by-type/:type", authorize("read"), ItemController.getByType);

export default router;
