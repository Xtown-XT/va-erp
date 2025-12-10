// src/modules/employeeAttendance/employeeAttendance.zod.js
import { z } from "zod";

// Reusable YYYY-MM-DD date string validator
const dateYYYYMMDD = z
  .string()
  .refine(
    (val) => /^\d{4}-\d{2}-\d{2}$/.test(val),
    { message: "Invalid date format, expected YYYY-MM-DD" }
  );

export const createEmployeeAttendanceSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID"),
  presence: z.enum(["present", "absent"]).optional().default("present"),
  workStatus: z.enum(["working", "non-working"]).optional().default("working"),
  salary: z
    .number({ invalid_type_error: "Salary must be a number" })
    .min(0, "Salary must be non-negative")
    .optional()
    .default(0),
  date: dateYYYYMMDD,
  siteId: z.string().uuid("Invalid site ID format").nullable().optional(),
  machineId: z.string().uuid("Invalid machine ID format").nullable().optional(),
});

export const updateEmployeeAttendanceSchema = createEmployeeAttendanceSchema.partial();

export const deleteEmployeeAttendanceSchema = z.object({});

// Batch upsert schema - accepts array of attendance records
export const batchUpsertEmployeeAttendanceSchema = z.object({
  records: z.array(createEmployeeAttendanceSchema).min(1, "At least one attendance record is required"),
});
