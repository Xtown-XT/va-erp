import { z } from "zod";

export const createMachineSchema = z.object({
  vehicleType: z.string().min(1).max(255), // DB column name kept for compatibility
  vehicleNumber: z.string().min(1).max(255).transform(val => val.toUpperCase()), // DB column name kept
  status: z.enum(["active", "inactive"]).optional(),
  brandId: z.string().uuid("Invalid brand ID format"),
  vehicleRPM: z.number().min(0, "Starting RPM must be non-negative").nullable().optional(),
  nextServiceRPM: z.number().min(0, "Next service RPM must be non-negative").nullable().optional(),
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

export const deleteMachineSchema = z.any();
