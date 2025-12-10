import { Router } from "express";
import { DrillingToolsController } from "./drillingTools.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { authorize } from "../../shared/middlewares/auth.js";
import {
    createDrillingToolsSchema,
    updateDrillingToolsSchema,
    deleteDrillingToolsSchema,
} from "./drillingTools.zod.js";

const router = Router();

router.post(
    "/",
    authorize("create"),
    validate(createDrillingToolsSchema),
    DrillingToolsController.create
);
router.post("/instances", authorize("create"), DrillingToolsController.createInstance);
router.get("/instances", authorize("read"), DrillingToolsController.getInstances);
router.get("/", authorize("read"), DrillingToolsController.getAll);
router.get("/:id", authorize("read"), DrillingToolsController.getById);
router.put(
    "/:id",
    authorize("update"),
    validate(updateDrillingToolsSchema),
    DrillingToolsController.update
);
router.delete(
    "/:id",
    authorize("delete"),
    validate(deleteDrillingToolsSchema),
    DrillingToolsController.softDelete
);
router.delete("/:id/hard", authorize("delete"), DrillingToolsController.hardDelete);
router.post("/:id/restore", authorize("update"), DrillingToolsController.restore);

export default router;
