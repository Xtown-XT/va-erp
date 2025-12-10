import { z } from "zod";

const dateYYYYMMDD = z
  .string()
  .refine((val) => /^\d{4}-\d{2}-\d{2}$/.test(val), { message: "Invalid date format, expected YYYY-MM-DD" });

export const createDailyEntrySchema = z.object({
  refNo: z.string().min(1, "Reference number is required"),
  date: dateYYYYMMDD,
  // Vehicle RPM - opening and closing
  vehicleOpeningRPM: z.number().min(0, "Vehicle opening RPM must be non-negative").optional(),
  vehicleClosingRPM: z.number().min(0, "Vehicle closing RPM must be non-negative").optional(),
  // Compressor RPM - opening and closing
  compressorOpeningRPM: z.number().min(0, "Compressor opening RPM must be non-negative").optional(),
  compressorClosingRPM: z.number().min(0, "Compressor closing RPM must be non-negative").optional(),
  // Diesel and meter readings
  dieselUsed: z.number().min(0, "Diesel used must be non-negative").optional(),
  vehicleHSD: z.number().min(0, "Vehicle HSD must be non-negative").optional(),
  compressorHSD: z.number().min(0, "Compressor HSD must be non-negative").optional(),
  meter: z.number().min(0, "Meter reading must be non-negative").optional(),
  // Number of holes drilled
  noOfHoles: z.number().min(0, "Number of holes must be non-negative").optional(),
  vehicleServiceDone: z.boolean().optional(),
  compressorServiceDone: z.boolean().optional(),
  employeeId: z.string().uuid("Invalid employee ID format").optional(),
  employeeIds: z.array(z.string().uuid("Invalid employee ID format")).optional(),
  employees: z.array(z.object({
    employeeId: z.string().uuid("Invalid employee ID format"),
    role: z.enum(["operator", "helper"]),
    shift: z.number().int().min(1),
  })).optional(),
  // Machine fields (new aliases)
  machineId: z.string().uuid("Invalid machine ID format").optional(),
  machineOpeningRPM: z.number().min(0, "Machine opening RPM must be non-negative").optional(),
  machineClosingRPM: z.number().min(0, "Machine closing RPM must be non-negative").optional(),
  machineHSD: z.number().min(0, "Machine HSD must be non-negative").optional(),

  siteId: z.string().uuid("Invalid site ID format").optional(),
  vehicleId: z.string().uuid("Invalid vehicle ID format").optional(),
  compressorId: z.string().uuid("Invalid compressor ID format").optional(),
  // New spares structure
  machineSpares: z.array(z.object({
    itemId: z.string().uuid("Invalid item ID format"),
    itemName: z.string().optional(),
    partNumber: z.string().optional(),
    quantity: z.number().int().min(1),
    serviceName: z.string().min(1, "Service name is required"),
    addedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  })).optional(),
  compressorSpares: z.array(z.object({
    itemId: z.string().uuid("Invalid item ID format"),
    itemName: z.string().optional(),
    partNumber: z.string().optional(),
    quantity: z.number().int().min(1),
    serviceName: z.string().min(1, "Service name is required"),
    addedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  })).optional(),
  drillingTools: z.array(z.object({
    itemId: z.string().uuid("Invalid item ID format"),
    itemName: z.string().optional(),
    partNumber: z.string().optional(),
    quantity: z.number().int().min(1),
    itemServiceId: z.string().uuid("Invalid item service ID format").optional(),
    action: z.enum(["fit", "update", "remove"]).optional(),
    dailyRPM: z.number().min(0).optional(),
    dailyMeter: z.number().min(0).optional(),
    startingRPM: z.number().min(0).optional(),
    currentRPM: z.number().min(0).optional(),
    addedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  })).optional(),
  additionalEmployeeIds: z.array(z.string().uuid("Invalid employee ID format")).optional(),
  notes: z.string().optional(),
  shift: z.number().int().min(1).max(2, "Shift must be 1 or 2"),
});

export const updateDailyEntrySchema = createDailyEntrySchema.partial();

export const deleteDailyEntrySchema = z.object({});
