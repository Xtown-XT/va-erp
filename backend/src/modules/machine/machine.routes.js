import { Router } from "express";
import { machineController } from "./machine.controller.js";
import { validate } from "../../shared/middlewares/validate.js";
import { authorize } from "../../shared/middlewares/auth.js";
import {
    createMachineSchema,
    updateMachineSchema,
    deleteMachineSchema,
} from "./machine.zod.js";

const router = Router();

router.post(
    "/",
    authorize("create"),
    validate(createMachineSchema),
    machineController.create
);
router.get("/", authorize("read"), machineController.getAll);
router.get("/:id", authorize("read"), machineController.getById);
router.put(
    "/:id",
    authorize("update"),
    validate(updateMachineSchema),
    machineController.update
);
router.delete(
    "/:id",
    authorize("delete"),
    validate(deleteMachineSchema),
    machineController.softDelete
);
router.delete("/:id/hard", authorize("delete"), machineController.hardDelete);
router.post("/:id/restore", authorize("update"), machineController.restore);

export default router;
