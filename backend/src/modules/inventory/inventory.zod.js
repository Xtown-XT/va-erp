import { z } from "zod";

export const createPurchaseSchema = z.object({
    date: z.string().optional(), // ISO date string
    spareId: z.string().uuid().optional().nullable(),
    drillingToolId: z.string().uuid().optional().nullable(),
    supplierId: z.string().optional().nullable(),
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0),
    totalPrice: z.number().min(0).optional(),
}).refine(data => data.spareId || data.drillingToolId, {
    message: "Either spareId or drillingToolId is required",
});

export const updateSiteStockSchema = z.object({
    siteId: z.string().uuid(),
    spareId: z.string().uuid().optional().nullable(),
    drillingToolId: z.string().uuid().optional().nullable(),
    quantity: z.number().int(),
    mode: z.enum(['add', 'set']).optional(),
    serialNumber: z.string().optional(),
    initialRPM: z.number().optional(),
    initialMeter: z.number().optional()
});
