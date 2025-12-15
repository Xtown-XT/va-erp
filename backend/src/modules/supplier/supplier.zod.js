import { z } from "zod";

export const createSupplierSchema = z.object({
  supplierName: z.string().min(1).max(255),
  gstNumber: z.string().max(255).optional(),
  phone: z.union([
    z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
    z.literal(""),
    z.null(),
    z.undefined()
  ]).optional().nullable(),
  email: z.union([
    z.string().email("Please enter a valid email"),
    z.literal(""),
    z.null(),
    z.undefined()
  ]).optional().nullable(),
  address: z.string().min(1).max(255),
  status: z.enum(["active", "inactive"]).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const deleteSupplierSchema = z.any();
