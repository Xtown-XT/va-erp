import { z } from "zod";

export const createDrillingToolsSchema = z.object({
    name: z.string().min(1, "Name is required"),
    partNumber: z.string().optional(),
    rpmSource: z.enum(["machine", "compressor"], {
        required_error: "RPM source is required",
        invalid_type_error: "RPM source must be 'machine' or 'compressor'"
    }),
    price: z.coerce.number().optional().nullable(),
});

export const updateDrillingToolsSchema = z.object({
    name: z.string().min(1).optional(),
    partNumber: z.string().optional(),
    rpmSource: z.enum(["machine", "compressor"]).optional(),
    price: z.coerce.number().optional().nullable(),
});

export const deleteDrillingToolsSchema = z.any();
