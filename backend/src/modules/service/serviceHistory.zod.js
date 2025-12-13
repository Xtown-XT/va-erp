import { z } from "zod";

export const createServiceHistorySchema = z.object({
    serviceType: z.string(),
    serviceName: z.string().optional(),
    serviceDate: z.string().optional(),
    currentRpm: z.number().min(0).optional(),
    nextServiceRPM: z.number().min(0).optional(),
    machineId: z.string().uuid().optional().nullable(),
    compressorId: z.string().uuid().optional().nullable(),
    description: z.string().optional(),
    sparesUsed: z.array(z.any()).optional(),
    totalCost: z.number().min(0).optional()
});

export const updateServiceHistorySchema = createServiceHistorySchema.partial();

export const deleteServiceHistorySchema = z.object({});
