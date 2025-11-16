import { z } from "zod";

export const createItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  partNumber: z.string().min(1, "Part number is required"),
  groupName: z.string().min(1, "Group name is required"),
  units: z.enum(["kg", "ltr", "mtr", "nos", "set", "unit", "kit"]),
  purchaseRate: z.number().min(0, "Purchase rate must be non-negative"),
  gst: z.number().min(0, "GST must be non-negative").optional().default(0),
  itemType: z.string().min(1, "Item type is required"),
  stock: z.number().min(0, "Stock must be non-negative").optional().default(0),
  // Model name for drilling tools (auto-generated)
  modelName: z.string().optional(),
});

export const updateItemSchema = z.object({
  itemName: z.string().min(1).optional(),
  partNumber: z.string().min(1).optional(),
  groupName: z.string().min(1).optional(),
  units: z.enum(["kg", "ltr", "mtr", "nos", "set", "unit", "kit"]).optional(),
  purchaseRate: z.number().min(0).optional(),
  gst: z.number().min(0).optional(),
  itemType: z.string().min(1).optional(),
  stock: z.number().min(0).optional(),
  openingStock: z.number().min(0).optional(),
  inward: z.number().min(0).optional(),
  outward: z.number().min(0).optional(),
  balance: z.number().min(0).optional(),
});

export const deleteItemSchema = z.object({});
