import { Router } from "express";
import { SparesController } from "./spares.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { authorize } from "../../shared/middlewares/auth.js";
import {
    createSparesSchema,
    updateSparesSchema,
    deleteSparesSchema,
} from "./spares.zod.js";

const router = Router();

router.post(
    "/",
    authorize("create"),
    validate(createSparesSchema),
    SparesController.create
);
router.get("/", authorize("read"), SparesController.getAll);
router.get("/:id", authorize("read"), SparesController.getById);
router.put(
    "/:id",
    authorize("update"),
    validate(updateSparesSchema),
    SparesController.update
);
router.delete(
    "/:id",
    authorize("delete"),
    validate(deleteSparesSchema),
    SparesController.softDelete
);
router.delete("/:id/hard", authorize("delete"), SparesController.hardDelete);
router.post("/:id/restore", authorize("update"), SparesController.restore);

export default router;
