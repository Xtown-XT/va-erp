import { z } from "zod";

export const createMachineSchema = z.object({
    machineType: z.string().min(1).max(255), // DB column name kept for compatibility
    machineNumber: z.string().min(1).max(255).transform(val => val.toUpperCase()), // DB column name kept
    status: z.enum(["active", "inactive"]).optional(),
    brandId: z.string().uuid("Invalid brand ID format"),
    machineRPM: z.number().min(0, "Starting RPM must be non-negative").nullable().optional(),
    serviceCycleRpm: z.number().int().min(1, "Service cycle must be at least 1").optional(),
    engineServiceCycleRpm: z.number().int().min(1, "Engine service cycle must be at least 1").optional(),
    lastServiceRPM: z.number().int().min(0).optional(),
    lastEngineServiceRPM: z.number().int().min(0).optional(),
    compressorId: z.union([
        z.string().uuid("Invalid compressor ID format"),
        z.null()
    ]).optional(),
    siteId: z.union([
        z.string().uuid("Invalid site ID format"),
        z.null()
    ]).optional(),
});

export const updateMachineSchema = createMachineSchema.partial();

export const deleteMachineSchema = z.object({});
