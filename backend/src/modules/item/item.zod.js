import { z } from "zod";

export const createItemSchema = z.object({
  itemName: z.string().min(1).optional(),
  partNumber: z.string().min(1).optional(),
  groupName: z.string().min(1).optional(),
  units: z.enum(["kg", "ltr", "mtr", "nos", "set", "unit", "kit"]),
  purchaseRate: z.number().min(0).optional(),
  gst: z.number().min(0).optional(),
  canBeFitted: z.boolean().optional(),
  stock: z.union([z.number().min(0), z.null()]).optional(), // For non-fittable items (number), null for fittable items
  // Fields for fittable items (auto-generated when canBeFitted=true)
  modelName: z.string().optional(),
  currentRPM: z.number().min(0).optional(),
  nextServiceRPM: z.number().min(0).optional(),
  status: z.enum(["in_stock", "fitted", "removed"]).optional(),
});

export const updateItemSchema = createItemSchema.partial();

export const deleteItemSchema = z.object({});
