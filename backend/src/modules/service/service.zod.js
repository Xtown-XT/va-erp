import { z } from "zod";

export const createServiceSchema = z.object({
  serviceRPM: z.number().positive("Service RPM must be positive"),
  nextServiceRPM: z.number().min(0, "Next service RPM must be non-negative").optional(),
  serviceDate: z.string().date("Invalid date format").optional(),
  serviceType: z.enum(["machine", "compressor", "item"]), // Changed from "vehicle" to "machine"
  serviceName: z.string().optional(),
  vehicleId: z.string().uuid("Invalid vehicle ID format").optional(),
  compressorId: z.string().uuid("Invalid compressor ID format").optional(),
  itemId: z.string().uuid("Invalid item ID format").optional(),
  notes: z.string().optional(),
  createdBy: z.string().optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

export const deleteServiceSchema = z.object({});
