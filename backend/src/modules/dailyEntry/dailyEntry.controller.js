import DailyEntry from "./dailyEntry.model.js";
import Machine from "../vehicle/vehicle.model.js";
import Compressor from "../compressor/compressor.model.js";
import Service from "../service/service.model.js";
import EmployeeList from "../employee/employeeList.model.js";
import Item from "../item/item.model.js";
import ItemService from "../itemService/itemService.model.js";
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

  // Helper: Process machine spares
  processMachineSpares = async (machineSpares, dailyEntryId, vehicleId, date, username, transaction) => {
    if (!machineSpares || machineSpares.length === 0) return;

    for (const spare of machineSpares) {
      const { itemId, quantity, serviceName } = spare;
      const item = await Item.findByPk(itemId, { transaction });
      if (!item) continue;

      // Verify sufficient balance (handle null/undefined balance)
      const currentBalance = item.balance ?? 0;
      if (currentBalance < quantity) {
        throw new Error(`Insufficient balance for item ${item.itemName}. Available: ${currentBalance}, Required: ${quantity}`);
      }

      // Create ItemService record
      await ItemService.create({
        itemId,
        dailyEntryId,
        vehicleId,
        compressorId: null,
        serviceType: 'machine',
        fittedDate: date,
        fittedRPM: 0, // Not applicable for spares
        fittedMeter: null,
        quantity,
        status: 'fitted',
        createdBy: username,
      }, { transaction });

      // Update item inventory (reduce balance, increment outward)
      await item.update({
        outward: (item.outward || 0) + quantity,
        balance: (item.balance || 0) - quantity,
        updatedBy: username,
      }, { transaction });

      // Create service history record
      await Service.create({
        serviceRPM: 0,
        serviceType: 'machine',
        serviceName: serviceName,
        serviceDate: date,
        vehicleId,
        compressorId: null,
        itemId,
        createdBy: username,
      }, { transaction });
    }
  };

  // Helper: Process compressor spares
  processCompressorSpares = async (compressorSpares, dailyEntryId, compressorId, date, username, transaction) => {
    if (!compressorSpares || compressorSpares.length === 0) return;

    for (const spare of compressorSpares) {
      const { itemId, quantity, serviceName } = spare;
      const item = await Item.findByPk(itemId, { transaction });
      if (!item) continue;

      // Verify sufficient balance (handle null/undefined balance)
      const currentBalance = item.balance ?? 0;
      if (currentBalance < quantity) {
        throw new Error(`Insufficient balance for item ${item.itemName}. Available: ${currentBalance}, Required: ${quantity}`);
      }

      // Create ItemService record
      await ItemService.create({
        itemId,
        dailyEntryId,
        vehicleId: null,
        compressorId,
        serviceType: 'compressor',
        fittedDate: date,
        fittedRPM: 0, // Not applicable for spares
        fittedMeter: null,
        quantity,
        status: 'fitted',
        createdBy: username,
      }, { transaction });

      // Update item inventory (reduce balance, increment outward)
      await item.update({
        outward: (item.outward || 0) + quantity,
        balance: (item.balance || 0) - quantity,
        updatedBy: username,
      }, { transaction });

      // Create service history record
      await Service.create({
        serviceRPM: 0,
        serviceType: 'compressor',
        serviceName: serviceName,
        serviceDate: date,
        vehicleId: null,
        compressorId,
        itemId,
        createdBy: username,
      }, { transaction });
    }
  };

  // Endpoint: Get fitted drilling tools for a compressor
  getFittedDrillingTools = async (req, res, next) => {
    try {
      const { compressorId } = req.params;
      if (!compressorId) {
        return res.status(400).json({ success: false, message: "Compressor ID is required" });
      }

      // Get all fitted drilling tools for this compressor
      // We need the latest ItemService record for each item (grouped by itemId)
      const fittedTools = await ItemService.findAll({
        where: {
          compressorId,
          serviceType: 'drilling_tool',
          status: 'fitted',
        },
        include: [
          {
            model: Item,
            as: 'item',
            attributes: ['id', 'itemName', 'partNumber', 'itemType'],
          },
        ],
        order: [['fittedDate', 'DESC'], ['createdAt', 'DESC']],
      });

      // Group by itemId and get the latest one for each item
      const toolsMap = new Map();
      fittedTools.forEach(tool => {
        const itemId = tool.itemId;
        if (!toolsMap.has(itemId)) {
          toolsMap.set(itemId, tool);
        }
      });

      const tools = Array.from(toolsMap.values()).map(tool => ({
        id: tool.id, // ItemService ID
        itemServiceId: tool.id,
        itemId: tool.itemId,
        itemName: tool.item?.itemName || '',
        partNumber: tool.item?.partNumber || '',
        quantity: tool.quantity || 1,
        currentRPM: tool.fittedRPM || 0,
        currentMeter: tool.fittedMeter || 0,
        totalRPMRun: tool.totalRPMRun || 0,
        totalMeterRun: tool.totalMeterRun || 0,
        fittedDate: tool.fittedDate,
        isExisting: true,
      }));

      return res.json({ success: true, data: tools });
    } catch (error) {
      next(error);
    }
  };

  // Helper: Process drilling tools
  processDrillingTools = async (drillingTools, dailyEntryId, compressorId, currentCompressorRPM, currentMeter, date, username, transaction) => {
    if (!drillingTools || drillingTools.length === 0) return;

    for (const tool of drillingTools) {
      const { itemId, quantity, itemServiceId, action, dailyRPM, dailyMeter } = tool;
      const item = await Item.findByPk(itemId, { transaction });
      if (!item) continue;

      // Handle removal
      if (action === 'remove') {
        // Find the latest fitted ItemService for this item and compressor
        const itemService = await ItemService.findOne({
          where: {
            itemId,
            compressorId,
            serviceType: 'drilling_tool',
            status: 'fitted',
          },
          order: [['fittedDate', 'DESC'], ['createdAt', 'DESC']],
          transaction,
        });

        if (!itemService) continue;

        // Calculate final totals including today's RPM/meter
        const finalRPM = (itemService.fittedRPM || 0) + (dailyRPM || 0);
        const finalMeter = (itemService.fittedMeter || 0) + (dailyMeter || 0);

        // Update ItemService status to removed
        await itemService.update({
          removedDate: date,
          removedRPM: currentCompressorRPM || 0,
          removedMeter: currentMeter || 0,
          totalRPMRun: finalRPM,
          totalMeterRun: finalMeter,
          status: 'removed',
          updatedBy: username,
        }, { transaction });

        // Restore stock to inventory
        await item.update({
          inward: (item.inward || 0) + quantity,
          balance: (item.balance || 0) + quantity,
          updatedBy: username,
        }, { transaction });

        continue;
      }

      // Handle existing tool update (add daily RPM/meter)
      if (itemServiceId && action !== 'fit') {
        // Find the latest fitted ItemService for this item and compressor
        const itemService = await ItemService.findOne({
          where: {
            itemId,
            compressorId,
            serviceType: 'drilling_tool',
            status: 'fitted',
          },
          order: [['fittedDate', 'DESC'], ['createdAt', 'DESC']],
          transaction,
        });

        if (!itemService) continue;

        // Update RPM and meter by adding daily totals
        const newRPM = (itemService.fittedRPM || 0) + (dailyRPM || 0);
        const newMeter = (itemService.fittedMeter || 0) + (dailyMeter || 0);

        // Update the existing ItemService record with new accumulated values
        await itemService.update({
          fittedRPM: newRPM,
          fittedMeter: newMeter,
          updatedBy: username,
        }, { transaction });

        // Also create a new ItemService record for this daily entry to track the update
        await ItemService.create({
          itemId,
          dailyEntryId,
          vehicleId: null,
          compressorId,
          serviceType: 'drilling_tool',
          fittedDate: date,
          fittedRPM: newRPM,
          fittedMeter: newMeter,
          quantity,
          status: 'fitted',
          createdBy: username,
        }, { transaction });

        continue;
      }

      // Handle new tool (fit new drilling tool)
      // Check if there's a previously removed tool for this item+compressor to continue from
      const previousRemovedTool = await ItemService.findOne({
        where: {
          itemId,
          compressorId,
          serviceType: 'drilling_tool',
          status: 'removed',
        },
        order: [['removedDate', 'DESC'], ['createdAt', 'DESC']],
        transaction,
      });

      // If there's a previous removed tool, continue from its totalRPMRun and totalMeterRun
      // Otherwise, start from the daily RPM/meter values
      const startingRPM = previousRemovedTool 
        ? (previousRemovedTool.totalRPMRun || previousRemovedTool.fittedRPM || 0) + (dailyRPM || 0)
        : (dailyRPM || currentCompressorRPM || 0);
      const startingMeter = previousRemovedTool
        ? (previousRemovedTool.totalMeterRun || previousRemovedTool.fittedMeter || 0) + (dailyMeter || 0)
        : (dailyMeter || currentMeter || 0);

      // Verify sufficient balance (handle null/undefined balance)
      const currentBalance = item.balance ?? 0;
      if (currentBalance < quantity) {
        throw new Error(`Insufficient balance for item ${item.itemName}. Available: ${currentBalance}, Required: ${quantity}`);
      }

      // Create ItemService record
      await ItemService.create({
        itemId,
        dailyEntryId,
        vehicleId: null,
        compressorId,
        serviceType: 'drilling_tool',
        fittedDate: date,
        fittedRPM: startingRPM,
        fittedMeter: startingMeter,
        quantity,
        status: 'fitted',
        createdBy: username,
      }, { transaction });

      // Update item inventory (reduce balance, increment outward)
      await item.update({
        outward: (item.outward || 0) + quantity,
        balance: (item.balance || 0) - quantity,
        updatedBy: username,
      }, { transaction });
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

    // Process machine spares
    if (req.body.machineSpares && req.body.machineSpares.length > 0) {
      await this.processMachineSpares(
        req.body.machineSpares,
        entry.id,
        machineId,
        entry.date,
        req.user.username,
        transaction
      );
    }

    // Process compressor spares
    if (req.body.compressorSpares && req.body.compressorSpares.length > 0 && compressorId) {
      await this.processCompressorSpares(
        req.body.compressorSpares,
        entry.id,
        compressorId,
        entry.date,
        req.user.username,
        transaction
      );
    }

    // Process drilling tools
    if (req.body.drillingTools && req.body.drillingTools.length > 0 && compressorId) {
      const currentCompressorRPM = (compressorClosingRPM || 0) - (compressorOpeningRPM || 0);
      const currentMeter = req.body.meter || 0;
      await this.processDrillingTools(
        req.body.drillingTools,
        entry.id,
        compressorId,
        currentCompressorRPM,
        currentMeter,
        entry.date,
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

    // Process service items for machine
    if (req.body.machineServiceItems && req.body.machineServiceItems.length > 0 && machineId) {
      const machine = await Machine.findByPk(machineId, { transaction });
      await this.processServiceItems(
        req.body.machineServiceItems,
        id,
        machineId,
        null,
        'machine',
        vehicleClosingRPM || machine?.vehicleRPM || 0,
        null,
        date || existingEntry.date,
        req.user.username,
        transaction
      );
    }

    // Process service items for compressor
    const effectiveCompressorId = compressorId || existingEntry.compressorId;
    if (req.body.compressorServiceItems && req.body.compressorServiceItems.length > 0 && effectiveCompressorId) {
      const compressor = await Compressor.findByPk(effectiveCompressorId, { transaction });
      await this.processServiceItems(
        req.body.compressorServiceItems,
        id,
        null,
        effectiveCompressorId,
        'compressor',
        compressorClosingRPM || compressor?.compressorRPM || 0,
        req.body.meter || existingEntry.meter || 0,
        date || existingEntry.date,
        req.user.username,
        transaction
      );
    }

    // Process drilling tools
    if (req.body.drillingTools && req.body.drillingTools.length > 0 && effectiveCompressorId) {
      const compressor = await Compressor.findByPk(effectiveCompressorId, { transaction });
      const currentCompressorRPM = compressorClosingRPM || compressor?.compressorRPM || 0;
      const currentMeter = req.body.meter || existingEntry.meter || 0;
      
      for (const tool of req.body.drillingTools) {
        const { itemId, action, startingRPM, endingRPM, startingMeter, endingMeter, itemServiceId } = tool;
        
        if (action === 'fit') {
          // Fit a new drilling tool
          const item = await Item.findByPk(itemId, { transaction });
          if (!item || item.balance < 1) {
            throw new Error(`Insufficient balance for drilling tool ${item?.itemName || itemId}`);
          }

          // Create ItemService record for drilling tool
          await ItemService.create({
            itemId,
            dailyEntryId: id,
            vehicleId: null,
            compressorId: effectiveCompressorId,
            serviceType: 'drilling_tool',
            fittedDate: date || existingEntry.date,
            fittedRPM: startingRPM || currentCompressorRPM,
            fittedMeter: startingMeter || currentMeter,
            quantity: 1,
            status: 'fitted',
            createdBy: req.user.username,
          }, { transaction });

          // Update item inventory
          await item.update({
            outward: item.outward + 1,
            balance: item.balance - 1,
            updatedBy: req.user.username,
          }, { transaction });
        } else if (action === 'remove' && itemServiceId) {
          // Remove an existing drilling tool
          const itemService = await ItemService.findByPk(itemServiceId, { transaction });
          if (!itemService || itemService.status !== 'fitted') continue;

          const endingRPMValue = endingRPM || currentCompressorRPM;
          const endingMeterValue = endingMeter || currentMeter;
          const totalRPMRun = endingRPMValue - itemService.fittedRPM;
          const totalMeterRun = endingMeterValue && itemService.fittedMeter 
            ? endingMeterValue - itemService.fittedMeter 
            : null;

          // Update ItemService record
          await itemService.update({
            removedDate: date || existingEntry.date,
            removedRPM: endingRPMValue,
            removedMeter: endingMeterValue,
            totalRPMRun,
            totalMeterRun,
            status: 'removed',
            updatedBy: req.user.username,
          }, { transaction });
        }
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
      const { page = 1, limit = 10, startDate, endDate, date, siteId, vehicleId, machineId, empId, employeeId, compressorId, shift } = req.query;
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
      if (compressorId) {
        where.compressorId = compressorId;
      }
      if (shift) {
        where.shift = parseInt(shift);
      }

      // Build include with optional employee filter
      const employeeInclude = {
        model: EmployeeList, 
        as: "employees", 
        attributes: ["id", "name", "empId"],
        through: { attributes: ["role", "shift"] }
      };
      
      // Filter by employee code or ID if provided
      if (empId) {
        employeeInclude.where = { empId: { [Op.like]: `%${empId}%` } };
        employeeInclude.required = true; // Only return entries with matching employees
      } else if (employeeId) {
        employeeInclude.where = { id: employeeId };
        employeeInclude.required = true; // Only return entries with matching employees
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
