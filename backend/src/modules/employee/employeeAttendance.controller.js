import EmployeeAttendance from "./employeeAttendance.model.js";
import EmployeeList from "./employeeList.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";
import { Op } from "sequelize";

// 1. Create CRUD service from model
const EmployeeAttendanceCrud = new BaseCrud(EmployeeAttendance);

// 2. Create custom controller with date filtering
export class EmployeeAttendanceController extends BaseController {
  constructor() {
    super(EmployeeAttendanceCrud, "Employee Attendance");
  }

  // Override getAll to handle date filtering (single date or range)
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, date, startDate, endDate, siteId } = req.query;

      // Build where clause for filtering
      const whereClause = {};

      // Date filtering
      if (date) {
        whereClause.date = date;
      } else if (startDate && endDate) {
        whereClause.date = { [Op.between]: [startDate, endDate] };
      } else if (startDate) {
        whereClause.date = { [Op.gte]: startDate };
      } else if (endDate) {
        whereClause.date = { [Op.lte]: endDate };
      }

      // Site filtering
      if (siteId) {
        whereClause.siteId = siteId;
      }


      const items = await this.service.getAll(page, limit, {
        where: whereClause,
        include: [
          {
            association: 'employee',
            attributes: ['id', 'name', 'empId']
          },
          {
            association: 'site',
            attributes: ['id', 'siteName']
          },
          {
            association: 'machine',
            attributes: ['id', 'machineNumber', 'machineType']
          }
        ]
      });

      return res.json({ success: true, ...items });
    } catch (error) {
      next(error);
    }
  };

  // Override create method to automatically deduct salary from advance
  create = async (req, res, next) => {
    const transaction = await EmployeeAttendance.sequelize.transaction();
    try {
      const { employeeId, salary } = req.body;
      const username = (req.user && (req.user.username || req.user.name)) || "system";

      // Create attendance record with createdBy from JWT
      const attendancePayload = {
        ...req.body,
        createdBy: username,
      };
      const attendance = await this.service.create(attendancePayload, { transaction });

      // Advance deduction logic removed as per user request.

      await transaction.commit();

      return res.status(201).json({
        success: true,
        message: "Attendance created successfully",
        data: attendance
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  };

  // Override update method to handle salary deduction changes
  update = async (req, res, next) => {
    const transaction = await EmployeeAttendance.sequelize.transaction();
    try {
      const { id } = req.params;
      const { employeeId, salary } = req.body;
      const username = (req.user && (req.user.username || req.user.name)) || "system";

      // Get the existing attendance record to compare salary
      const existingAttendance = await EmployeeAttendance.findByPk(id, { transaction });
      if (!existingAttendance) {
        return res.status(404).json({ success: false, message: "Attendance record not found" });
      }

      // Update attendance record with updatedBy from JWT
      const updatePayload = {
        ...req.body,
        updatedBy: username,
      };


      const updatedAttendance = await this.service.update(id, updatePayload, { transaction });

      // Advance deduction logic removed as per user request.

      await transaction.commit();

      return res.json({
        success: true,
        message: "Attendance updated successfully",
        data: updatedAttendance
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  };

  // Deduct salary from advanced amount (manual method)
  deductSalaryFromAdvance = async (req, res, next) => {
    try {
      const { employeeId, salaryAmount } = req.body;
      const updatedBy = req.user.username;

      const employee = await EmployeeList.findByPk(employeeId);
      if (!employee) {
        return res.status(404).json({ success: false, message: "Employee not found" });
      }

      const currentAdvance = employee.advancedAmount || 0;
      const newAdvanceAmount = Math.max(0, currentAdvance - salaryAmount);

      await employee.update({
        advancedAmount: newAdvanceAmount,
        updatedBy
      });

      return res.json({
        success: true,
        message: "Salary deducted from advance amount",
        data: {
          employeeId,
          salaryAmount,
          previousAdvance: currentAdvance,
          newAdvanceAmount: newAdvanceAmount,
          deducted: currentAdvance - newAdvanceAmount
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Upsert attendance (create or update) - prevents duplicate key conflicts
  upsertAttendance = async (req, res, next) => {
    const transaction = await EmployeeAttendance.sequelize.transaction();
    try {
      const { employeeId, date, presence, workStatus, salary, siteId, machineId } = req.body;
      const username = (req.user && (req.user.username || req.user.name)) || "system";

      // Check if attendance already exists for this employee on this date
      const existingAttendance = await EmployeeAttendance.findOne({
        where: { employeeId, date },
        transaction
      });

      let attendance;
      let isNew = false;

      if (existingAttendance) {
        // Update existing attendance - use provided values or defaults, fallback to existing
        const updatePayload = {
          presence: presence !== undefined ? presence : (existingAttendance.presence || 'present'),
          workStatus: workStatus !== undefined ? workStatus : (existingAttendance.workStatus || 'working'),
          salary: salary !== undefined ? salary : (existingAttendance.salary || 0),
          siteId: siteId !== undefined ? siteId : existingAttendance.siteId,
          machineId: machineId !== undefined ? machineId : existingAttendance.machineId,
          updatedBy: username,
        };

        // Advance deduction logic removed as per user request.

        await existingAttendance.update(updatePayload, { transaction });
        attendance = existingAttendance;
      } else {
        // Create new attendance - use provided values or defaults
        isNew = true;
        const createPayload = {
          employeeId,
          date,
          presence: presence !== undefined ? presence : 'present',
          workStatus: workStatus !== undefined ? workStatus : 'working',
          salary: salary !== undefined ? salary : 0,
          siteId: siteId || null,
          machineId: machineId || null,
          createdBy: username,
        };

        attendance = await EmployeeAttendance.create(createPayload, { transaction });

        // Advance deduction logic removed as per user request.
      }

      await transaction.commit();

      return res.status(isNew ? 201 : 200).json({
        success: true,
        message: isNew ? "Attendance created successfully" : "Attendance updated successfully",
        data: attendance,
        isNew
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  };

  // Batch upsert attendance - Optimized for performance
  upsertBatchAttendance = async (req, res, next) => {
    const transaction = await EmployeeAttendance.sequelize.transaction();
    try {
      const { records } = req.body; // Array of attendance records
      const username = (req.user && (req.user.username || req.user.name)) || "system";

      if (!Array.isArray(records) || records.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Records array is required and must not be empty"
        });
      }

      const date = records[0].date;
      const employeeIds = records.map(r => r.employeeId);

      // 1. Pre-fetch all relevant employees and existing attendance in parallel
      const [employees, existingAttendances] = await Promise.all([
        EmployeeList.findAll({
          where: { id: employeeIds }, // Fetch only involved employees
          attributes: ['id', 'advancedAmount'],
          transaction
        }),
        EmployeeAttendance.findAll({
          where: {
            employeeId: employeeIds,
            date: date
          },
          transaction
        })
      ]);

      // Create lookup maps for O(1) access
      const employeeMap = new Map(employees.map(e => [e.id, e]));
      const attendanceMap = new Map(existingAttendances.map(a => [a.employeeId, a]));

      const attendanceUpserts = [];
      const employeeUpdates = [];

      // 3. Process records in memory
      for (const record of records) {
        const { employeeId, presence, workStatus, salary, siteId, machineId } = record;
        // const employee = employeeMap.get(employeeId); // Employee data not needed for deduction anymore
        const existingAttendance = attendanceMap.get(employeeId);

        // Prepare Attendance Upsert Data
        attendanceUpserts.push({
          id: existingAttendance ? existingAttendance.id : undefined, // Include ID if updating
          employeeId,
          date,
          presence: presence || 'present',
          workStatus: workStatus || 'working',
          salary: Number(salary) || 0,
          siteId: siteId || null, // Keep existing siteId if not provided? No, payload usually has it.
          machineId: machineId || null,
          createdBy: existingAttendance?.createdBy || username, // FIX: Always provide createdBy
          updatedBy: username
        });
      }

      // 4. Perform Bulk Operations
      // Bulk Create/Update Attendance using bulkCreate with updateOnDuplicate
      await EmployeeAttendance.bulkCreate(attendanceUpserts, {
        updateOnDuplicate: ['presence', 'workStatus', 'salary', 'siteId', 'machineId', 'updatedBy'],
        transaction
      });

      // Advance deduction logic removed as per user request.

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: `Processed ${records.length} records successfully`,
        data: {
          total: records.length,
          updatedEmployees: 0
        }
      });

    } catch (error) {
      if (transaction) await transaction.rollback();
      next(error);
    }
  };
}

export const employeeAttendanceController = new EmployeeAttendanceController();
