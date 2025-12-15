import { z } from "zod";

export const createDrillingToolsSchema = z.object({
    name: z.string().min(1, "Name is required"),
    partNumber: z.string().optional(),
    copyRpm: z.enum(["machine", "compressor", "none"]).optional(),
    price: z.number().optional().nullable(),
});

export const updateDrillingToolsSchema = z.object({
    name: z.string().min(1).optional(),
    partNumber: z.string().optional(),
    copyRpm: z.enum(["machine", "compressor", "none"]).optional(),
    price: z.number().optional().nullable(),
});

export const deleteDrillingToolsSchema = z.any();
