import { z } from "zod";

export const fitItemSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  dailyEntryId: z.string().uuid("Invalid daily entry ID"),
  vehicleId: z.string().uuid("Invalid vehicle ID").optional().nullable(),
  compressorId: z.string().uuid("Invalid compressor ID").optional().nullable(),
  serviceType: z.enum(["machine", "compressor", "drilling_tool"]),
  fittedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  fittedRPM: z.number().nonnegative("Fitted RPM must be non-negative"),
  fittedMeter: z.number().nonnegative("Fitted meter must be non-negative").optional().nullable(),
  quantity: z.number().positive("Quantity must be positive").default(1),
});

export const removeItemSchema = z.object({
  removedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  removedRPM: z.number().nonnegative("Removed RPM must be non-negative"),
  removedMeter: z.number().nonnegative("Removed meter must be non-negative").optional().nullable(),
});

