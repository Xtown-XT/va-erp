import { z } from "zod";

export const createCompressorSchema = z.object({
  compressorName: z.string().min(1).max(255),
  status: z.enum(["active", "inactive"]).optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().date("Invalid date format").optional(),
  compressorRPM: z.number().min(0, "Compressor RPM must be non-negative").optional(),
  serviceCycleRpm: z.number().int().min(1, "Service cycle must be at least 1").optional(),
  engineServiceCycleRpm: z.number().int().min(1, "Engine service cycle must be at least 1").optional(),
  lastServiceRPM: z.number().int().min(0).optional(),
  lastEngineServiceRPM: z.number().int().min(0).optional(),
});

export const updateCompressorSchema = createCompressorSchema.partial();

export const deleteCompressorSchema = z.object({});
