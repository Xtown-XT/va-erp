import { z } from "zod";

export const createDrillingToolLogSchema = z.object({
    drillingToolId: z.string().uuid("Invalid tool ID"),
    compressorId: z.string().uuid("Invalid compressor ID").optional().nullable(),
    siteId: z.string().uuid("Invalid site ID").optional().nullable(),
    action: z.enum(["INSTALL", "REMOVE"]),
    date: z.string().optional(), // Allow full date string or just date
    rpm: z.number().int().min(0).optional(),
    meter: z.number().min(0).optional(),
    quantity: z.number().int().min(1).default(1).optional(),
    description: z.string().optional()
});

export const updateDrillingToolLogSchema = createDrillingToolLogSchema.partial();

export const deleteDrillingToolLogSchema = z.object({});
