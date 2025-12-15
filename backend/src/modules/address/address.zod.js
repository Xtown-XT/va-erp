import { z } from "zod";

export const createAddressSchema = z.object({
  addressBill: z.string().min(1).max(255),
  addressShip: z.string().min(1).max(255),
  phone: z.union([
    z.string().regex(/^\d{10,11}$/, "Phone number must be 10-11 digits"),
    z.literal(""),
    z.null()
  ]).optional(),
  email: z.union([
    z.string().email().max(255),
    z.literal(""),
    z.null()
  ]).optional(),
});

export const updateAddressSchema = createAddressSchema.partial();

export const deleteAddressSchema = z.any();
