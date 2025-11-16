import EmployeeList from "./employeeList.model.js";
import EmployeeAttendance from "./employeeAttendance.model.js";
import Site from "../site/site.model.js";
import Vehicle from "../vehicle/vehicle.model.js";
import DailyEntry from "../dailyEntry/dailyEntry.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";
import { Op } from "sequelize";

// 1. Create CRUD service from model
const EmployeeCrud = new BaseCrud(EmployeeList);

// 2. Create custom controller with proper advance amount handling
class EmployeeListCustomController extends BaseController {
  constructor() {
    super(EmployeeCrud, "Employee");
  }

  // Override create method to properly initialize advancedAmount
  create = async (req, res, next) => {
    try {
      const { advancedAmount, ...otherData } = req.body;
      const createdBy = req.user.username;

      // Set advancedAmount
      const employeeData = {
        ...otherData,
        advancedAmount: advancedAmount || 0,
        createdBy
      };

      const employee = await EmployeeList.create(employeeData);
      
      return res.status(201).json({
        success: true,
        message: "Employee created successfully",
        data: employee
      });
    } catch (error) {
      next(error);
    }
  };

  // Override update method to handle advance amount changes
  update = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { advancedAmount, ...otherData } = req.body;
      const updatedBy = req.user.username;

      // Update employee with new data including advancedAmount
      await EmployeeList.update(
        { ...otherData, advancedAmount: advancedAmount || 0, updatedBy },
        { where: { id } }
      );

      const updatedEmployee = await EmployeeList.findByPk(id);
      
      return res.json({
        success: true,
        message: "Employee updated successfully",
        data: updatedEmployee
      });
    } catch (error) {
      next(error);
    }
  };

  // Get employee work history and statistics
  getEmployeeHistory = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50, startDate, endDate } = req.query;
      const offset = (page - 1) * limit;
      
      // Get employee with all related data
      const employee = await EmployeeList.findByPk(id, {
        include: [
          {
            model: EmployeeAttendance,
            as: 'attendances',
            include: [
              { model: Site, as: 'site' },
              { model: Vehicle, as: 'vehicle' }
            ],
            order: [['date', 'DESC']]
          }
        ]
      });

      if (!employee) {
        return res.status(404).json({ 
          success: false, 
          message: "Employee not found" 
        });
      }

      // Build where clause for daily entries
      const where = {};
      if (startDate && endDate) {
        where.date = {
          [Op.between]: [startDate, endDate]
        };
      }

      // Get daily entries where this employee was involved
      // We need to join with DailyEntryEmployee to get role and shift
      const DailyEntryEmployee = (await import('../dailyEntry/dailyEntryEmployee.model.js')).default;
      const Compressor = (await import('../compressor/compressor.model.js')).default;
      
      const dailyEntries = await DailyEntry.findAll({
        where,
        include: [
          { 
            model: Site, 
            as: 'site',
            attributes: ['id', 'siteName', 'location']
          },
          { 
            model: Vehicle, 
            as: 'vehicle',
            attributes: ['id', 'vehicleNumber', 'vehicleType']
          },
          {
            model: Compressor,
            as: 'compressor',
            attributes: ['id', 'compressorName'],
            required: false
          },
          { 
            model: DailyEntryEmployee,
            as: 'dailyEntryEmployees',
            where: { employeeId: id },
            required: true,
            attributes: ['role', 'shift']
          }
        ],
        order: [['date', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Count total entries
      const totalEntries = await DailyEntry.count({
        where,
        include: [{
          model: DailyEntryEmployee,
          as: 'dailyEntryEmployees',
          where: { employeeId: id },
          required: true
        }]
      });

      // Transform data for cleaner response
      const workHistory = dailyEntries.map(entry => {
        const empData = entry.dailyEntryEmployees?.[0] || {};
        return {
          date: entry.date,
          refNo: entry.refNo,
          site: entry.site?.siteName || 'N/A',
          machine: entry.vehicle?.vehicleNumber || 'N/A',
          machineType: entry.vehicle?.vehicleType || 'N/A',
          compressor: entry.compressor?.compressorName || 'N/A',
          role: empData.role || 'N/A',
          shift: empData.shift || 1,
          vehicleOpeningRPM: entry.vehicleOpeningRPM,
          vehicleClosingRPM: entry.vehicleClosingRPM,
          compressorOpeningRPM: entry.compressorOpeningRPM,
          compressorClosingRPM: entry.compressorClosingRPM,
          noOfHoles: entry.noOfHoles || 0
        };
      });

      // Calculate statistics
      const attendances = employee.attendances || [];
      const totalDaysWorked = workHistory.length;
      const totalSalaryPaid = attendances.reduce((sum, a) => sum + (a.salary || 0), 0);
      const uniqueSites = [...new Set(workHistory.map(w => w.site))].filter(s => s !== 'N/A');
      const uniqueMachines = [...new Set(workHistory.map(w => w.machine))].filter(m => m !== 'N/A');
      
      // Count days by role
      const operatorDays = workHistory.filter(w => w.role === 'operator').length;
      const helperDays = workHistory.filter(w => w.role === 'helper').length;

      return res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            empId: employee.empId,
            name: employee.name,
            designation: employee.designation,
            phone: employee.phone,
            joiningDate: employee.joiningDate,
            status: employee.status,
            advancedAmount: employee.advancedAmount
          },
          workHistory,
          pagination: {
            total: totalEntries,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalEntries / limit)
          },
          statistics: {
            totalDaysWorked,
            operatorDays,
            helperDays,
            totalPresent: attendances.filter(a => a.presence === 'present').length,
            totalAbsent: attendances.filter(a => a.presence === 'absent').length,
            totalSalaryPaid,
            totalAdvanceTaken: employee.advancedAmount || 0,
            currentBalance: employee.advancedAmount || 0,
            uniqueSitesCount: uniqueSites.length,
            uniqueMachinesCount: uniqueMachines.length,
            uniqueSites: uniqueSites,
            uniqueMachines: uniqueMachines
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

export const EmployeeListController = new EmployeeListCustomController();
