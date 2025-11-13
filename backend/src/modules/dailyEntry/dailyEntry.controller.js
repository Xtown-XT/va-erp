import DailyEntry from "./dailyEntry.model.js";
import Machine from "../vehicle/vehicle.model.js";
import Compressor from "../compressor/compressor.model.js";
import Service from "../service/service.model.js";
import EmployeeList from "../employee/employeeList.model.js";
import Item from "../item/item.model.js";
import EmployeeAttendance from "../employee/employeeAttendance.model.js";
import Site from "../site/site.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";
import DailyEntryEmployee from "./dailyEntryEmployee.model.js";
import { Op } from "sequelize";

// 1. Create CRUD service from model
const DailyEntryCrud = new BaseCrud(DailyEntry);

// 2. Plug it into BaseController
class DailyEntryCustomController extends BaseController {
  constructor() {
    super(DailyEntryCrud, "DailyEntry");
  }
  // Auto-generate reference number with VA- prefix (simple sequential)
  generateRefNo = async () => {
    const count = await DailyEntry.count({
      where: {
        refNo: {
          [Op.like]: 'VA-%'
        },
        deletedAt: null
      }
    });
    return `VA-${String(count + 1).padStart(3, '0')}`;
  };

  // Endpoint: generate and return next ref no
  generateRef = async (req, res, next) => {
    try {
      const refNo = await this.generateRefNo();
      return res.json({ success: true, refNo });
    } catch (error) {
      next(error);
    }
  };

  // Helper: Upsert attendance for employees in daily entry
  upsertEmployeeAttendance = async (employees, siteId, machineId, date, username, transaction) => {
    try {
      for (const emp of employees) {
        const employeeId = emp.employeeId;
        
        // Check if attendance exists for this employee on this date
        const existingAttendance = await EmployeeAttendance.findOne({
          where: { employeeId, date },
          transaction
        });

        if (existingAttendance) {
          // Update existing attendance - mark as present and update site/vehicle
          await existingAttendance.update({
            presence: 'present',
            workStatus: 'working',
            siteId,
            vehicleId: machineId, // DB column kept as vehicleId
            updatedBy: username
          }, { transaction });
        } else {
          // Create new attendance record
          await EmployeeAttendance.create({
            employeeId,
            date,
            presence: 'present',
            workStatus: 'working',
            salary: 0,
            siteId,
            vehicleId: machineId, // DB column kept as vehicleId
            createdBy: username
          }, { transaction });
        }
      }
    } catch (error) {
      console.error('Error upserting employee attendance:', error);
      throw error;
    }
  };

  

  create = async (req, res, next) => {
  const transaction = await DailyEntry.sequelize.transaction();
  try {
    const { 
      vehicleId, // Keep for DB compatibility, but treat as machineId in code
      vehicleOpeningRPM, 
      vehicleClosingRPM,
      compressorId, 
      compressorOpeningRPM, 
      compressorClosingRPM, 
      vehicleServiceDone,
      vehicleServiceName,
      compressorServiceDone,
      compressorServiceName,
      employeeId, 
      employees = [],
      additionalEmployeeIds = [],
      fittedItemInstanceIds = [],
      removedItemInstanceIds = [],
      notes,
      compressorHSD,
      shift = 1,
      date,
      siteId
    } = req.body;
    const machineId = vehicleId; // Alias for clarity in code

    // Auto-generate reference number if not provided
    const refNo = req.body.refNo || await this.generateRefNo();

    // Handle employees array - new structure with roles and shifts
    let processedEmployees = [];
    let primaryEmployeeId = null;

    if (employees && employees.length > 0) {
      // New structure: employees array with role and shift
      processedEmployees = employees.map(emp => ({
        dailyEntryId: null, // Will be set after entry creation
        employeeId: emp.employeeId,
        role: emp.role || 'operator',
        shift: emp.shift || 1
      }));
      
      // Find first shift 1 operator for backward compatibility
      const shift1Operator = employees.find(e => e.shift === 1 && e.role === 'operator');
      primaryEmployeeId = shift1Operator ? shift1Operator.employeeId : employees[0]?.employeeId;
    } else if (employeeId) {
      // Legacy support: convert old format to new format
      processedEmployees = [{ dailyEntryId: null, employeeId, role: 'operator', shift: 1 }];
      primaryEmployeeId = employeeId;
      
      // Add additional employees with shift 2
      if (additionalEmployeeIds && additionalEmployeeIds.length > 0) {
        additionalEmployeeIds.forEach((eid, index) => {
          processedEmployees.push({
            dailyEntryId: null,
            employeeId: eid,
            role: 'operator',
            shift: 2 + index
          });
        });
      }
    } else {
      return res.status(400).json({ success: false, message: "At least one employee (Shift 1 Operator) is required" });
    }

    // Validate: At least one shift 1 operator is required
    const hasShift1Operator = processedEmployees.some(e => e.shift === 1 && e.role === 'operator');
    if (!hasShift1Operator) {
      return res.status(400).json({ success: false, message: "At least one Shift 1 Operator is required" });
    }

    // Create entry first
    const entryPayload = { 
      ...req.body, 
      refNo,
      shift: shift || 1,
      employeeId: primaryEmployeeId, // Keep for backward compatibility
      notes: notes || null,
      compressorId: compressorId || null,
      compressorHSD: compressorHSD || null,
      createdBy: req.user.username 
    };
    const entry = await DailyEntry.create(entryPayload, { transaction });

    // Attach all employees with role and shift
    if (processedEmployees.length) {
      const rows = processedEmployees.map(emp => ({
        ...emp,
        dailyEntryId: entry.id
      }));
      await DailyEntryEmployee.bulkCreate(rows, { transaction });
    }

    // Handle item fitting - update status to fitted
    if (fittedItemInstanceIds.length > 0) {
      for (const itemId of fittedItemInstanceIds) {
        const item = await Item.findByPk(itemId, { transaction });
        if (item && item.canBeFitted && item.status === 'in_stock') {
          await item.update({
            status: 'fitted',
            fittedToVehicleId: machineId, // DB column kept
            fittedDate: entry.date,
            updatedBy: req.user?.username || "system"
          }, { transaction });
        }
      }
    }

    // Handle item removal - update status back to in_stock
    if (removedItemInstanceIds.length > 0) {
      for (const itemId of removedItemInstanceIds) {
        const item = await Item.findByPk(itemId, { transaction });
        if (item && item.canBeFitted && item.status === 'fitted' && item.fittedToVehicleId === machineId) {
          await item.update({
            status: 'in_stock',
            fittedToVehicleId: null,
            fittedDate: null,
            removedDate: entry.date,
            updatedBy: req.user?.username || "system"
          }, { transaction });
        }
      }
    }

    // Update machine RPM totals
    const machine = await Machine.findByPk(machineId, { transaction });
    if (machine) {
      const machineRPMDiff = (vehicleClosingRPM || 0) - (vehicleOpeningRPM || 0);
      await machine.update({
        vehicleRPM: (machine.vehicleRPM || 0) + Math.max(0, machineRPMDiff) // DB column kept
      }, { transaction });

      const serviceCreates = [];
      if (vehicleServiceDone) serviceCreates.push(Service.create({ serviceRPM: machine.vehicleRPM, serviceType: "machine", serviceName: vehicleServiceName || null, vehicleId: machineId, compressorId: machine.compressorId, createdBy: req.user.username }, { transaction }));
      if (serviceCreates.length) await Promise.all(serviceCreates);
    }

    // Update compressor RPM totals
    if (compressorId) {
      const compressor = await Compressor.findByPk(compressorId, { transaction });
      if (compressor) {
        const compressorRPMDiff = (compressorClosingRPM || 0) - (compressorOpeningRPM || 0);
        await compressor.update({
          compressorRPM: (compressor.compressorRPM || 0) + Math.max(0, compressorRPMDiff)
        }, { transaction });

        if (compressorServiceDone) {
          await Service.create({
            serviceRPM: compressor.compressorRPM,
            serviceType: "compressor",
            serviceName: compressorServiceName || null,
            vehicleId: machineId, // DB column kept
            compressorId,
            createdBy: req.user.username
          }, { transaction });
        }
      }
    }

    // Update RPM for fitted items using compressor RPM
    // Each shift adds its own compressor RPM - total accumulates naturally
    const shiftCompressorRPM = Math.max(0, (compressorClosingRPM || 0) - (compressorOpeningRPM || 0));
    
    if (shiftCompressorRPM > 0 && compressorId) {
      // Get all items currently fitted to this machine (including newly fitted ones)
      const allFittedItems = await Item.findAll({
        where: {
          fittedToVehicleId: machineId,
          status: 'fitted',
          canBeFitted: true,
        },
        transaction
      });

      // Add this shift's compressor RPM to all fitted items
      // When both shifts are saved, the total (shift1 + shift2) will be added
      for (const item of allFittedItems) {
        await item.increment('currentRPM', {
          by: shiftCompressorRPM,
          transaction
        });
      }
    }

    // Auto-create/update attendance for all employees
    if (processedEmployees.length > 0) {
      await this.upsertEmployeeAttendance(
        processedEmployees,
        siteId,
        machineId,
        date || entry.date,
        req.user.username,
        transaction
      );
    }

    await transaction.commit();
    
    // Fetch the created entry with relationships
    const createdEntry = await DailyEntry.findByPk(entry.id, {
      include: [
        { model: EmployeeList, as: "primaryEmployee", attributes: ["id", "name", "empId"] },
        { model: EmployeeList, as: "employees", attributes: ["id", "name", "empId"] },
        { model: Machine, as: "machine", attributes: ["id", "vehicleType", "vehicleNumber"] },
        { model: Site, as: "site", attributes: ["id", "siteName"] },
      ],
    });
    
    return res.status(201).json({ success: true, message: "DailyEntry created successfully", data: createdEntry });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

update = async (req, res, next) => {
  const transaction = await DailyEntry.sequelize.transaction();
  try {
    const { id } = req.params;
    const { 
      vehicleId, // Keep for DB compatibility, but treat as machineId in code
      vehicleOpeningRPM, 
      vehicleClosingRPM,
      compressorId, 
      compressorOpeningRPM, 
      compressorClosingRPM, 
      vehicleServiceDone,
      vehicleServiceName,
      compressorServiceDone,
      compressorServiceName,
      employeeId, 
      employees = [],
      additionalEmployeeIds = [],
      fittedItemInstanceIds = [],
      removedItemInstanceIds = [],
      notes,
      compressorHSD,
      shift,
      date,
      siteId
    } = req.body;
    // Find the existing entry
    const existingEntry = await DailyEntry.findByPk(id, { transaction });
    if (!existingEntry) {
      return res.status(404).json({ success: false, message: "DailyEntry not found" });
    }
    const machineId = vehicleId || existingEntry.vehicleId; // Alias for clarity

    // Handle employees array - new structure with roles and shifts
    let processedEmployees = [];
    let primaryEmployeeId = null;

    if (employees && employees.length > 0) {
      // New structure: employees array with role and shift
      processedEmployees = employees.map(emp => ({
        dailyEntryId: id,
        employeeId: emp.employeeId,
        role: emp.role || 'operator',
        shift: emp.shift || 1
      }));
      
      // Find first shift 1 operator for backward compatibility
      const shift1Operator = employees.find(e => e.shift === 1 && e.role === 'operator');
      primaryEmployeeId = shift1Operator ? shift1Operator.employeeId : employees[0]?.employeeId;
    } else if (employeeId) {
      // Legacy support: convert old format to new format
      processedEmployees = [{ dailyEntryId: id, employeeId, role: 'operator', shift: 1 }];
      primaryEmployeeId = employeeId;
      
      // Add additional employees with shift 2
      if (additionalEmployeeIds && additionalEmployeeIds.length > 0) {
        additionalEmployeeIds.forEach((eid, index) => {
          processedEmployees.push({
            dailyEntryId: id,
            employeeId: eid,
            role: 'operator',
            shift: 2 + index
          });
        });
      }
    }

    // Validate: At least one shift 1 operator is required if employees are being updated
    if (req.body.hasOwnProperty('employees') || req.body.hasOwnProperty('employeeId')) {
      const hasShift1Operator = processedEmployees.some(e => e.shift === 1 && e.role === 'operator');
      if (!hasShift1Operator && processedEmployees.length > 0) {
        return res.status(400).json({ success: false, message: "At least one Shift 1 Operator is required" });
      }
    }

    // Update the main entry
    const updatePayload = { 
      ...req.body,
      shift: shift !== undefined ? shift : existingEntry.shift,
      employeeId: primaryEmployeeId || existingEntry.employeeId, // Keep for backward compatibility
      notes: notes !== undefined ? (notes || null) : existingEntry.notes,
      compressorId: compressorId !== undefined ? (compressorId || null) : existingEntry.compressorId,
      compressorHSD: compressorHSD !== undefined ? (compressorHSD || null) : existingEntry.compressorHSD,
      updatedBy: req.user.username 
    };
    
    await existingEntry.update(updatePayload, { transaction });

    // Handle employees - delete existing and create new
    if (req.body.hasOwnProperty('employees') || req.body.hasOwnProperty('additionalEmployeeIds') || req.body.hasOwnProperty('employeeId')) {
      // Remove all existing employee relationships
      await DailyEntryEmployee.destroy({
        where: { dailyEntryId: id },
        transaction
      });

      // Add all employees with role and shift
      if (processedEmployees.length) {
        await DailyEntryEmployee.bulkCreate(processedEmployees, { transaction });
      }
    }

    // Handle item fitting - update status to fitted
    if (fittedItemInstanceIds && fittedItemInstanceIds.length > 0) {
      for (const itemId of fittedItemInstanceIds) {
        const item = await Item.findByPk(itemId, { transaction });
        if (item && item.canBeFitted && item.status === 'in_stock') {
          await item.update({
            status: 'fitted',
            fittedToVehicleId: machineId, // DB column kept
            fittedDate: existingEntry.date,
            updatedBy: req.user?.username || "system"
          }, { transaction });
        }
      }
    }

    // Handle item removal - update status back to in_stock
    if (removedItemInstanceIds && removedItemInstanceIds.length > 0) {
      for (const itemId of removedItemInstanceIds) {
        const item = await Item.findByPk(itemId, { transaction });
        if (item && item.canBeFitted && item.status === 'fitted' && item.fittedToVehicleId === machineId) {
          await item.update({
            status: 'in_stock',
            fittedToVehicleId: null,
            fittedDate: null,
            removedDate: existingEntry.date,
            updatedBy: req.user?.username || "system"
          }, { transaction });
        }
      }
    }

    // Update machine RPM totals
    if (machineId) {
      const machine = await Machine.findByPk(machineId, { transaction });
      if (machine) {
        const machineRPMDiff = (vehicleClosingRPM || 0) - (vehicleOpeningRPM || 0);
        await machine.update({
          vehicleRPM: (machine.vehicleRPM || 0) + Math.max(0, machineRPMDiff) // DB column kept
        }, { transaction });

        const serviceCreates = [];
        if (vehicleServiceDone) serviceCreates.push(Service.create({ serviceRPM: machine.vehicleRPM, serviceType: "machine", serviceName: vehicleServiceName || null, vehicleId: machineId, compressorId: machine.compressorId, createdBy: req.user.username }, { transaction }));
        if (serviceCreates.length) await Promise.all(serviceCreates);
      }
    }

    // Update compressor RPM totals
    if (compressorId) {
      const compressor = await Compressor.findByPk(compressorId, { transaction });
      if (compressor) {
        const compressorRPMDiff = (compressorClosingRPM || 0) - (compressorOpeningRPM || 0);
        await compressor.update({
          compressorRPM: (compressor.compressorRPM || 0) + Math.max(0, compressorRPMDiff)
        }, { transaction });

        if (compressorServiceDone) {
          await Service.create({
            serviceRPM: compressor.compressorRPM,
            serviceType: "compressor",
            serviceName: compressorServiceName || null,
            vehicleId: machineId, // DB column kept
            compressorId,
            createdBy: req.user.username
          }, { transaction });
        }
      }
    }

    // Auto-update attendance for all employees if employees were updated
    if (req.body.hasOwnProperty('employees') || req.body.hasOwnProperty('employeeId')) {
      if (processedEmployees.length > 0) {
        await this.upsertEmployeeAttendance(
          processedEmployees,
          siteId || existingEntry.siteId,
          machineId,
          date || existingEntry.date,
          req.user.username,
          transaction
        );
      }
    }

    await transaction.commit();

    // Fetch the updated entry with relationships
    const updatedEntry = await DailyEntry.findByPk(id, {
      include: [
        { model: EmployeeList, as: "primaryEmployee", attributes: ["id", "name", "empId"] },
        { model: EmployeeList, as: "employees", attributes: ["id", "name", "empId"] },
        { model: Machine, as: "machine", attributes: ["id", "vehicleType", "vehicleNumber"] },
        { model: Site, as: "site", attributes: ["id", "siteName"] },
      ],
    });

    return res.json({ 
      success: true, 
      message: "DailyEntry updated successfully", 
      data: updatedEntry 
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};


  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, startDate, endDate, date, siteId, vehicleId, machineId, empId } = req.query;
      const where = {};
      if (date) {
        where.date = date;
      } else if (startDate && endDate) {
        where.date = { [Op.between]: [startDate, endDate] };
      } else if (startDate) {
        where.date = { [Op.gte]: startDate };
      } else if (endDate) {
        where.date = { [Op.lte]: endDate };
      }
      if (siteId) {
        where.siteId = siteId;
      }
      // Support both vehicleId (legacy) and machineId (new)
      const effectiveMachineId = machineId || vehicleId;
      if (effectiveMachineId) {
        where.vehicleId = effectiveMachineId; // DB column kept as vehicleId
      }

      // Build include with optional employee code filter
      const employeeInclude = {
        model: EmployeeList, 
        as: "employees", 
        attributes: ["id", "name", "empId"],
        through: { attributes: ["role", "shift"] }
      };
      
      // Filter by employee code if provided
      if (empId) {
        employeeInclude.where = { empId: { [Op.like]: `%${empId}%` } };
      }

      const items = await this.service.getAll(page, limit, {
        where,
        include: [
          { model: EmployeeList, as: "primaryEmployee", attributes: ["id", "name", "empId"] },
          employeeInclude,
          { model: Machine, as: "machine", attributes: ["id", "vehicleType", "vehicleNumber"] }, // Changed alias to machine
          { model: Site, as: "site", attributes: ["id", "siteName"] },
        ],
      });
      
      // Transform employees to include role and shift from through table
      if (items.data) {
        items.data = items.data.map(item => {
          // Get site before toJSON to ensure it's preserved
          const siteData = item.site || (item.get && item.get('site'));
          const siteObj = siteData ? (siteData.toJSON ? siteData.toJSON() : siteData) : null;
          
          const transformed = item.toJSON ? item.toJSON() : item;
          if (transformed.employees) {
            transformed.employees = transformed.employees.map(emp => ({
              ...emp,
              role: emp.DailyEntryEmployee?.role || 'operator',
              shift: emp.DailyEntryEmployee?.shift || 1
            }));
          }
          // Explicitly preserve site object
          if (siteObj) {
            transformed.site = siteObj;
          } else if (!transformed.site && transformed.siteId) {
            // If site wasn't loaded but we have siteId, set a placeholder
            transformed.site = { id: transformed.siteId, siteName: null };
          }
          return transformed;
        });
      }
      
      return res.json({ success: true, ...items });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const entry = await DailyEntry.findByPk(req.params.id, {
        include: [
          { model: EmployeeList, as: "primaryEmployee", attributes: ["id", "name", "empId"] },
          { 
            model: EmployeeList, 
            as: "employees", 
            attributes: ["id", "name", "empId"],
            through: { attributes: ["role", "shift"] }
          },
          { model: Machine, as: "machine", attributes: ["id", "vehicleType", "vehicleNumber"] },
          { model: Site, as: "site", attributes: ["id", "siteName"] },
        ],
      });
      if (!entry) return res.status(404).json({ success: false, message: "DailyEntry not found" });
      
      // Transform employees to include role and shift from through table
      const transformed = entry.toJSON ? entry.toJSON() : entry;
      if (transformed.employees) {
        transformed.employees = transformed.employees.map(emp => ({
          ...emp,
          role: emp.DailyEntryEmployee?.role || 'operator',
          shift: emp.DailyEntryEmployee?.shift || 1
        }));
      }
      
      return res.json({ success: true, data: transformed });
    } catch (error) {
      next(error);
    }
};
}

export const DailyEntryController = new DailyEntryCustomController(
  DailyEntryCrud,
  "DailyEntry"
);
