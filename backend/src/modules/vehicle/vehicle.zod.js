import { z } from "zod";

export const createMachineSchema = z.object({
  vehicleType: z.string().min(1).max(255), // DB column name kept for compatibility
  vehicleNumber: z.string().min(1).max(255).transform(val => val.toUpperCase()), // DB column name kept
  status: z.enum(["active", "inactive"]).optional(),
  brandId: z.string().uuid("Invalid brand ID format"),
  vehicleRPM: z.number().min(0, "Starting RPM must be non-negative").optional(), // DB column name kept
  nextServiceRPM: z.number().min(0, "Next service RPM must be non-negative").optional(),
  compressorId: z.string().uuid("Invalid compressor ID format").optional(),
});

export const updateMachineSchema = createMachineSchema.partial();

export const deleteMachineSchema = z.object({});
