import { z } from "zod";

export const createEmployeeSchema = z.object({
  empId: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  designation: z.string().max(100).nullable().optional(),
  phone: z.union([
    z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
    z.null()
  ]).optional(),
  joiningDate: z.union([
    z.string().date("Invalid date format"),
    z.null()
  ]).optional(),
  status: z.enum(["active", "inactive", "resigned"]).optional(),
  advancedAmount: z.union([
    z.number().nonnegative(),
    z.null()
  ]).optional(),
  siteId: z.string().uuid().nullable().optional(),
  dailySalary: z.number().nonnegative().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const deleteEmployeeSchema = z.any();
