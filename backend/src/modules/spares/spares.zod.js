import { z } from "zod";

export const createSparesSchema = z.object({
    name: z.string().min(1, "Name is required"),
    partNumber: z.string().optional(),
    units: z.enum(['kg', 'litre', 'meters', 'nos', 'set', 'unit', 'kit']).optional().nullable(),
    spareType: z.enum(['machine', 'compressor']).optional().nullable(),
    price: z.coerce.number().optional().nullable(),
});

export const updateSparesSchema = z.object({
    name: z.string().min(1).optional(),
    partNumber: z.string().optional(),
    units: z.enum(['kg', 'litre', 'meters', 'nos', 'set', 'unit', 'kit']).optional().nullable(),
    spareType: z.enum(['machine', 'compressor']).optional().nullable(),
    price: z.coerce.number().optional().nullable(),
});

export const deleteSparesSchema = z.any();
