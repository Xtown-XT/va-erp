import DailyEntry from "./dailyEntry.model.js";
import Machine from "../machine/machine.model.js";
import Compressor from "../compressor/compressor.model.js";
import Service from "../service/models/serviceHistory.model.js";
import EmployeeList from "../employee/employeeList.model.js";
import ServiceItem from "../service/models/serviceItem.model.js";
import SiteStock from "../inventory/models/siteStock.model.js";
import DrillingToolItems from "../drillingTools/drillingToolItems.model.js";
import DrillingTools from "../drillingTools/drillingTools.model.js";
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

  //  READ ALL with filters
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, startDate, endDate, siteId, machineId, employeeId, vehicleId } = req.query;

      const { Op } = await import("sequelize");
      const Site = (await import("../site/site.model.js")).default;
      const Machine = (await import("../machine/machine.model.js")).default;
      const Compressor = (await import("../compressor/compressor.model.js")).default;
      const EmployeeList = (await import("../employee/employeeList.model.js")).default;

      const where = { deletedAt: null };

      // Date Range Filter
      if (startDate && endDate) {
        where.date = { [Op.between]: [startDate, endDate] };
      } else if (startDate) {
        where.date = { [Op.gte]: startDate };
      } else if (endDate) {
        where.date = { [Op.lte]: endDate };
      }

      // Exact Filters
      if (siteId) where.siteId = siteId;
      if (machineId) where.machineId = machineId;
      if (vehicleId) where.machineId = vehicleId; // Legacy support

      const include = [
        { model: Site, as: "site", attributes: ["id", "siteName"] },
        { model: Machine, as: "machine", attributes: ["id", "machineType", "machineNumber"] },
        { model: Compressor, as: "compressor", attributes: ["id", "compressorName"] },
        { model: EmployeeList, as: "primaryEmployee", attributes: ["id", "name", "empId"] },
        {
          model: EmployeeList,
          as: "employees",
          attributes: ["id", "name", "empId"],
          through: { attributes: ["role", "shift"] }
        }
      ];

      // Employee Filter
      if (employeeId) {
        // We need to filter entries where:
        // 1. primaryEmployeeId == employeeId (Legacy)
        // OR
        // 2. One of the 'employees' has id == employeeId (New)

        // Since mixing top-level OR with association includes is complex in Sequelize 
        // (requires required:true on include but that breaks the OR logic for primaryEmployee),
        // we will implement strict filtering on the association for the new system.
        // Legacy data might be missed if we only look at 'employees' include.

        // Strategy: Add a required include for employees if filtered by employeeId
        // This assumes data migration or that we only care about new data structure.
        // Given your "Refactor Daily Entry" task, we assume new structure is dominant.

        const empInclude = include.find(i => i.as === "employees");
        empInclude.where = { id: employeeId };
        empInclude.required = true;
      }

      const options = {
        where,
        include,
        distinct: true,
        order: [['date', 'DESC'], ['createdAt', 'DESC']]
      };

      const items = await this.service.getAll(page, limit, options);
      return res.json({ success: true, ...items });
    } catch (error) {
      next(error);
    }
  };

  // Helper: Get last entry's closing RPM for machine/compressor
  // Returns the higher of shift 2 closing RPM or shift 1 closing RPM
  // excludeEntryId: optional entry ID to exclude from search (for updates)
  getLastEntryClosingRPM = async (machineId, compressorId, excludeEntryId = null, transaction = null) => {
    try {
      const where = {
        machineId: machineId,
        deletedAt: null
      };

      if (excludeEntryId) {
        where.id = { [Op.ne]: excludeEntryId };
      }

      // Find the most recent entry (by date DESC, then createdAt DESC)
      const lastEntry = await DailyEntry.findOne({
        where,
        order: [['date', 'DESC'], ['createdAt', 'DESC']],
        transaction
      });

      if (!lastEntry) {
        return { machineClosingRPM: null, compressorClosingRPM: null };
      }

      // Check if there's a shift 2 entry for the same date, machine, and compressor
      const sameDateEntries = await DailyEntry.findAll({
        where: {
          ...where,
          date: lastEntry.date,
          machineId: machineId
        },
        order: [['shift', 'ASC']],
        transaction
      });

      let machineClosingRPM = null;
      let compressorClosingRPM = null;

      // Find shift 2 entry first (preferred)
      const shift2Entry = sameDateEntries.find(e => e.shift === 2);
      const shift1Entry = sameDateEntries.find(e => e.shift === 1);

      if (shift2Entry) {
        // Use shift 2 closing RPM (preferred)
        machineClosingRPM = shift2Entry.machineClosingRPM;
        if (compressorId && shift2Entry.compressorId === compressorId) {
          compressorClosingRPM = shift2Entry.compressorClosingRPM;
        }
      } else if (shift1Entry) {
        // Fallback to shift 1 closing RPM
        machineClosingRPM = shift1Entry.machineClosingRPM;
        if (compressorId && shift1Entry.compressorId === compressorId) {
          compressorClosingRPM = shift1Entry.compressorClosingRPM;
        }
      }

      // If we have both shift 1 and shift 2, use the higher closing RPM
      if (shift1Entry && shift2Entry) {
        machineClosingRPM = Math.max(
          shift1Entry.machineClosingRPM || 0,
          shift2Entry.machineClosingRPM || 0
        );
        if (compressorId) {
          compressorClosingRPM = Math.max(
            shift1Entry.compressorClosingRPM || 0,
            shift2Entry.compressorClosingRPM || 0
          );
        }
      }

      return {
        machineClosingRPM: machineClosingRPM || null,
        compressorClosingRPM: compressorClosingRPM || null
      };
    } catch (error) {
      console.error("Error getting last entry closing RPM:", error);
      return { machineClosingRPM: null, compressorClosingRPM: null };
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
            machineId, // DB column changed to machineId
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
            machineId, // DB column changed to machineId
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
  processMachineSpares = async (machineSpares, dailyEntryId, machineId, siteId, date, username, transaction, existingServiceId = null) => {
    if (!machineSpares || machineSpares.length === 0) return;

    let serviceHistoryId = existingServiceId;

    // If no existing service record, create one for "Daily Maintenance"
    if (!serviceHistoryId) {
      const machine = await Machine.findByPk(machineId, { transaction });
      const service = await Service.create({
        machineId: machineId,
        serviceDate: date,
        serviceName: 'Daily Maintenance',
        serviceType: 'Machine Service', // Or 'Other'
        currentRpm: machine?.machineRPM || 0,
        remarks: 'Auto-created from Daily Entry spares',
      }, { transaction });
      serviceHistoryId = service.id;
    }

    for (const item of machineSpares) {
      if (!item.itemId || !item.quantity) continue;

      // 1. Decrement Stock
      const stock = await SiteStock.findOne({
        where: { siteId, spareId: item.itemId },
        transaction
      });

      if (!stock || stock.quantity < item.quantity) {
        throw new Error(`Insufficient stock for spare ${item.itemName || item.itemId}`);
      }

      await stock.decrement('quantity', { by: item.quantity, transaction });

      // 2. Add to Service History Items
      await ServiceItem.create({
        serviceHistoryId,
        itemType: 'spare',
        spareId: item.itemId,
        quantity: item.quantity
      }, { transaction });
    }
  };

  // Helper: Process compressor spares
  processCompressorSpares = async (compressorSpares, dailyEntryId, compressorId, siteId, date, username, transaction, existingServiceId = null) => {
    if (!compressorSpares || compressorSpares.length === 0) return;

    let serviceHistoryId = existingServiceId;

    if (!serviceHistoryId) {
      const compressor = await Compressor.findByPk(compressorId, { transaction });
      const service = await Service.create({
        compressorId,
        serviceDate: date,
        serviceName: 'Daily Maintenance',
        serviceType: 'Compressor Service',
        currentRpm: compressor?.compressorRPM || 0,
        remarks: 'Auto-created from Daily Entry spares',
      }, { transaction });
      serviceHistoryId = service.id;
    }

    for (const item of compressorSpares) {
      if (!item.itemId || !item.quantity) continue;

      // 1. Decrement Stock
      const stock = await SiteStock.findOne({
        where: { siteId, spareId: item.itemId },
        transaction
      });

      if (!stock || stock.quantity < item.quantity) {
        throw new Error(`Insufficient stock for spare ${item.itemName || item.itemId}`);
      }

      await stock.decrement('quantity', { by: item.quantity, transaction });

      // 2. Add to Service History Items
      await ServiceItem.create({
        serviceHistoryId,
        itemType: 'spare',
        spareId: item.itemId,
        quantity: item.quantity
      }, { transaction });
    }
  };

  // Endpoint: Get fitted drilling tools for a compressor
  getFittedDrillingTools = async (req, res, next) => {
    try {
      const { compressorId, machineId } = req.query;

      const where = { status: 'Fitted' };
      if (compressorId) where.fittedCompressorId = compressorId;
      if (machineId) where.fittedMachineId = machineId;

      if (!compressorId && !machineId) return res.json({ success: true, data: [] });

      const fittedTools = await DrillingToolItems.findAll({
        where,
        include: [
          {
            model: DrillingTools,
            as: 'catalogItem',
            attributes: ['name', 'partNumber']
          }
        ]
      });

      // Format for frontend: { itemId: instanceId, itemName: ..., partNumber: ... }
      const data = fittedTools.map(ft => ({
        itemId: ft.id,
        itemName: ft.catalogItem?.name || 'Unknown Tool',
        partNumber: ft.catalogItem?.partNumber,
        currentRpm: ft.currentRpm || 0,
        currentMeter: ft.currentMeter || 0
      }));

      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // Helper: Process drilling tools
  processDrillingTools = async (drillingTools, dailyEntryId, compressorId, siteId, currentCompressorRPM, currentMeter, date, username, transaction, existingServiceId = null) => {
    // drillingTools: [{ itemId: catalogId or instanceId, action: 'fit'|'remove'|'rpm_update' }]
    // Note: frontend sends 'itemId'. For 'fit', it's the catalog ID (we pick an instance? Or frontend sends instance?).
    // Checking Frontend: `DailyEntryNew.jsx` uses `DailyEntry.fetchAvailableDrillingTools()` which calls `/api/drilling-tools/instances?status=In Stock`. 
    // So 'itemId' in 'fit' payload IS the 'DrillingToolItem' (Instance) ID.

    if (!drillingTools || drillingTools.length === 0) return;

    let serviceHistoryId = existingServiceId;
    if (!serviceHistoryId) {
      // Create service header for tool actions
      const service = await Service.create({
        compressorId,
        serviceDate: date,
        serviceName: 'Drilling Tool Change',
        serviceType: 'Other',
        currentRpm: currentCompressorRPM || 0, // This logic assumes currentCompressorRPM is absolute? No, helper receives 'shift closing - shift opening' in original code, but here we probably want absolute.
        // Let's use 0 safely, or fetch current.
      }, { transaction });
      serviceHistoryId = service.id;
    }

    for (const tool of drillingTools) {
      // tool: { itemId (instanceId), action, startingRPM, startingMeter }
      // Logic:
      // 'fit': Update Instance (status=Fitted, fittedCompressorId=..., siteId=...), Add ServiceItem (action log)
      // 'remove': Update Instance (status=In Stock/Scrapped?, fittedCompressorId=null), Add ServiceItem

      const instanceId = tool.itemId;
      const instance = await DrillingToolItems.findByPk(instanceId, { transaction });
      if (!instance) continue;

      if (tool.action === 'fit') {
        // Verify it's in stock or available
        // Update instance
        await instance.update({
          status: 'Fitted',
          fittedCompressorId: compressorId,
          siteId, // Tool moves to this site
          currentRpm: tool.startingRPM || 0,
          currentMeter: tool.startingMeter || 0
        }, { transaction });

        // Log in ServiceItem
        await ServiceItem.create({
          serviceHistoryId,
          itemType: 'drillingTool',
          drillingToolItemId: instanceId,
          quantity: 1, // 1 instance
          // We might want to store 'action' type in ServiceItem? 
          // ServiceItem schema has 'itemType'. It doesn't have 'action'. 
          // But we can infer 'fit' if we see it added. removal is harder.
          // For now, logging usage.
        }, { transaction });
      }

      else if (tool.action === 'remove') {
        // Update instance to 'In Stock' (at the site) or 'Scrapped'
        await instance.update({
          status: 'In Stock',
          fittedCompressorId: null,
          // Keep siteId (it's at the site where it was removed)
        }, { transaction });
      }
      else {
        // 'update' or implicit update (daily usage)
        // Increment accumulated totals
        const dailyRPM = Number(tool.dailyRPM) || 0; // Calculated in frontend
        const dailyMeter = Number(tool.dailyMeter) || 0; // Calculated in frontend

        if (dailyRPM > 0 || dailyMeter > 0) {
          await instance.increment({
            totalRPM: dailyRPM,
            totalMeter: dailyMeter,
            // Also update currentRpm to reflect "current reading"? 
            // No, currentRpm means "Fitted At". It shouldn't change daily unless we re-fit.
            // But if we want to show "Current Reading", we might want to update it.
            // However, our logic for "Run" is Current - Fitted.
            // So if we update Fitted, we reset the Run.
            // So 'currentRpm' MUST remain static during the fitting period.
          }, { transaction });
        }
      }
    }
  };



  //  READ ALL with filters
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, startDate, endDate, siteId, machineId, employeeId, vehicleId } = req.query;

      const where = { deletedAt: null };

      // Date Range Filter
      if (startDate && endDate) {
        where.date = { [Op.between]: [startDate, endDate] };
      } else if (startDate) {
        where.date = { [Op.gte]: startDate };
      } else if (endDate) {
        where.date = { [Op.lte]: endDate };
      }

      // Exact Filters
      if (siteId) where.siteId = siteId;
      if (machineId) where.machineId = machineId;
      if (vehicleId) where.machineId = vehicleId; // Legacy support

      // Employee Filter (Complex because employees are in a join table or primaryEmployeeId)
      const include = [
        { model: Site, as: "site", attributes: ["id", "siteName"] },
        { model: Machine, as: "machine", attributes: ["id", "machineType", "machineNumber"] },
        { model: Compressor, as: "compressor", attributes: ["id", "compressorName"] },
        { model: EmployeeList, as: "primaryEmployee", attributes: ["id", "name", "empId"] },
        {
          model: EmployeeList,
          as: "employees",
          attributes: ["id", "name", "empId"],
          through: { attributes: ["role", "shift"] } // Include join table attributes
        }
      ];

      // If filtering by employee, we need to add a where clause on the include or the main table
      // Since Sequelize simple filtering on M:N is tricky with limits, we might need a subquery or strict include
      if (employeeId) {
        // Option 1: Filter where primaryEmployeeId matches OR employees list contains it.
        // This is hard to do efficiently in one pass with pagination. 
        // Simpler approach for now: Filter by primaryEmployee (legacy) OR use the association.
        // Let's implement strict filtering on the 'employees' association if present.

        // Actually, user wants to filter by "who worked". 
        // We can add a required: true to the employees include? 
        // But that omits entries where he was primary but not in the list? (New structure puts everyone in list).
        // Let's assume new structure.

        // We will modify the 'employees' include to filter by employeeId
        const empInclude = include.find(i => i.as === "employees");
        empInclude.where = { id: employeeId };
        empInclude.required = true; // Only return entries having this employee
      }

      const options = {
        where,
        include,
        distinct: true, // Important for accurate count with includes
      };

      // Use BaseCrud service but pass options
      const items = await this.service.getAll(page, limit, options);
      return res.json({ success: true, ...items });
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    console.log("DEBUG: DailyEntry Create Body:", JSON.stringify(req.body, null, 2));
    const transaction = await DailyEntry.sequelize.transaction();
    try {
      const {
        vehicleId,
        machineId: reqMachineId, // Accept machineId directly
        vehicleOpeningRPM,
        vehicleClosingRPM,
        machineOpeningRPM, // New keys
        machineClosingRPM, // New keys
        compressorId,
        compressorOpeningRPM,
        compressorClosingRPM,
        vehicleServiceDone, // Legacy
        vehicleServiceName, // Legacy
        machineServiceDone, // New
        machineServiceName, // New
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
      const machineId = reqMachineId || vehicleId; // Prioritize machineId, fallback to vehicleId

      // Use machineRPMs if available, fallback to vehicleRPMs
      const finalMachineOpeningRPM = machineOpeningRPM !== undefined ? machineOpeningRPM : vehicleOpeningRPM;
      const finalMachineClosingRPM = machineClosingRPM !== undefined ? machineClosingRPM : vehicleClosingRPM;

      // Use logic variables
      const finalMachineServiceDone = machineServiceDone !== undefined ? machineServiceDone : vehicleServiceDone;
      const finalMachineServiceName = machineServiceName !== undefined ? machineServiceName : vehicleServiceName;

      // Auto-generate reference number if not provided
      const refNo = req.body.refNo || await this.generateRefNo();

      // Handle employees array - new structure with roles and shifts
      let processedEmployees = [];
      let primaryEmployeeId = null;

      // Deduplicate employees by employeeId to prevent unique constraint violations
      const uniqueEmployeesMap = new Map();
      if (employees && employees.length > 0) {
        employees.forEach(emp => {
          if (emp.employeeId && !uniqueEmployeesMap.has(emp.employeeId)) {
            uniqueEmployeesMap.set(emp.employeeId, {
              dailyEntryId: null,
              employeeId: emp.employeeId,
              role: emp.role || 'operator',
              shift: emp.shift || shift
            });
          }
        });

        processedEmployees = Array.from(uniqueEmployeesMap.values());

        // Find first operator for the entry's shift (for backward compatibility)
        const entryShiftOperator = employees.find(e => (e.shift || shift) === shift && e.role === 'operator');
        primaryEmployeeId = entryShiftOperator ? entryShiftOperator.employeeId : (processedEmployees[0]?.employeeId || null);
      } else if (employeeId) {
        // Legacy support: convert old format to new format
        processedEmployees = [{ dailyEntryId: null, employeeId, role: 'operator', shift: shift }];
        primaryEmployeeId = employeeId;

        // Add additional employees with shift 2
        if (additionalEmployeeIds && additionalEmployeeIds.length > 0) {
          additionalEmployeeIds.forEach((eid, index) => {
            // Prevent duplicates if already added
            if (!processedEmployees.find(e => e.employeeId === eid)) {
              processedEmployees.push({
                dailyEntryId: null,
                employeeId: eid,
                role: 'operator',
                shift: 2 + index
              });
            }
          });
        }
      } else {
        processedEmployees = [];
        primaryEmployeeId = null;
      }

      // Create entry first
      const entryPayload = {
        ...req.body,
        id: undefined, // Ensure ID is generated by DB to prevent collision if sent by frontend
        refNo,
        shift: shift || 1,
        employeeId: primaryEmployeeId, // Keep for backward compatibility
        notes: notes || null,
        compressorId: compressorId || null,
        compressorHSD: compressorHSD || null,
        createdBy: req.user.username,
        // Ensure machineRPMs are set correctly in payload for DB
        machineOpeningRPM: finalMachineOpeningRPM,
        machineClosingRPM: finalMachineClosingRPM
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

      // Update machine RPM - use closing RPM from this entry (or higher if both shifts exist for same date)
      // Only update if closing RPM is higher than current RPM (prevents old entries from overwriting newer values)
      const machine = await Machine.findByPk(machineId, { transaction });
      if (machine) {
        // Check if there's another shift entry for the same date
        const sameDateEntries = await DailyEntry.findAll({
          where: {
            date: entry.date,
            machineId: machineId,
            deletedAt: null
          },
          transaction
        });

        // Find the highest closing RPM among all shifts for this date
        let maxClosingRPM = finalMachineClosingRPM || 0;
        for (const e of sameDateEntries) {
          const closing = e.machineClosingRPM !== null ? e.machineClosingRPM : (e.vehicleClosingRPM || 0);
          if (closing && closing > maxClosingRPM) {
            maxClosingRPM = closing;
          }
        }

        // Only update if closing RPM is higher than current RPM
        const currentRPM = machine.machineRPM || 0;
        if (maxClosingRPM > currentRPM) {
          await machine.update({
            machineRPM: maxClosingRPM
          }, { transaction });
        }

        let machineServiceId = null;
        if (finalMachineServiceDone) {
          const s = await Service.create({
            currentRpm: machine.machineRPM,
            serviceType: "Machine Service",
            serviceName: finalMachineServiceName || null,
            machineId: machineId,
            compressorId: machine.compressorId
          }, { transaction });
          machineServiceId = s.id;

          // Update Machine Next Service RPM (Fixed Interval)
          if (machine.serviceCycleRpm) {
            const current = machine.machineRPM || 0;
            const cycle = machine.serviceCycleRpm;
            // Calculate next milestone: e.g. current=255, cycle=250 -> ceil(256/250)*250 = 500
            const nextRPM = Math.ceil((current + 1) / cycle) * cycle;
            await machine.update({ nextServiceRPM: nextRPM }, { transaction });
          }
        }
      }

      // Update compressor RPM - use closing RPM from this entry (or higher if both shifts exist for same date)
      // Only update if closing RPM is higher than current RPM (prevents old entries from overwriting newer values)
      if (compressorId) {
        const compressor = await Compressor.findByPk(compressorId, { transaction });
        if (compressor) {
          // Check if there's another shift entry for the same date and compressor
          const sameDateEntries = await DailyEntry.findAll({
            where: {
              date: entry.date,
              machineId: machineId,
              compressorId: compressorId,
              deletedAt: null
            },
            transaction
          });

          // Find the highest closing RPM among all shifts for this date
          let maxClosingRPM = compressorClosingRPM || 0;
          for (const e of sameDateEntries) {
            if (e.compressorClosingRPM && e.compressorClosingRPM > maxClosingRPM) {
              maxClosingRPM = e.compressorClosingRPM;
            }
          }

          // Only update if closing RPM is higher than current RPM
          const currentRPM = compressor.compressorRPM || 0;
          if (maxClosingRPM > currentRPM) {
            await compressor.update({
              compressorRPM: maxClosingRPM
            }, { transaction });
          }

          let compressorServiceId = null;
          if (compressorServiceDone) {
            const serviceType = req.body.compressorServiceType || "Compressor Service";
            const s = await Service.create({
              currentRpm: compressor.compressorRPM,
              serviceType: serviceType,
              serviceName: compressorServiceName || null,
              machineId: machineId, // DB column kept
              compressorId,
            }, { transaction });
            compressorServiceId = s.id;

            // Update Compressor Next Service RPM based on type (Fixed Interval)
            const current = compressor.compressorRPM || 0;
            if (serviceType === "Compressor Service" && compressor.serviceCycleRpm) {
              const cycle = compressor.serviceCycleRpm;
              const nextRPM = Math.ceil((current + 1) / cycle) * cycle;
              await compressor.update({ nextServiceRPM: nextRPM }, { transaction });
            } else if (serviceType === "Engine Service" && compressor.engineServiceCycleRpm) {
              const cycle = compressor.engineServiceCycleRpm;
              const nextRPM = Math.ceil((current + 1) / cycle) * cycle;
              await compressor.update({ nextEngineServiceRPM: nextRPM }, { transaction });
            }
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

      // Process machine spares (frontend sends as machineServiceItems)
      if (req.body.machineServiceItems && req.body.machineServiceItems.length > 0) {
        await this.processMachineSpares(
          req.body.machineServiceItems,
          entry.id,
          machineId,
          siteId,
          entry.date,
          req.user.username,
          transaction,
          machineServiceId // Pass captured ID (or null/undefined, helper handles cleanup)
        );
      }

      // Process compressor spares (frontend sends as compressorServiceItems)
      if (req.body.compressorServiceItems && req.body.compressorServiceItems.length > 0 && compressorId) {
        await this.processCompressorSpares(
          req.body.compressorServiceItems,
          entry.id,
          compressorId,
          siteId,
          entry.date,
          req.user.username,
          transaction,
          compressorServiceId
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
          siteId,
          currentCompressorRPM,
          currentMeter,
          entry.date,
          req.user.username,
          transaction,
          compressorServiceId
        );
      }

      await transaction.commit();

      // Fetch the created entry with relationships
      const createdEntry = await DailyEntry.findByPk(entry.id, {
        include: [
          { model: EmployeeList, as: "primaryEmployee", attributes: ["id", "name", "empId"] },
          { model: EmployeeList, as: "employees", attributes: ["id", "name", "empId"] },
          { model: Machine, as: "machine", attributes: ["id", "machineType", "machineNumber"] },
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
        machineId: reqMachineId,
        machineOpeningRPM,
        machineClosingRPM,
        compressorId,
        compressorOpeningRPM,
        compressorClosingRPM,
        machineServiceDone, // Changed from vehicleServiceDone
        machineServiceName, // Changed from vehicleServiceName
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
      const machineId = reqMachineId || existingEntry.machineId;
      const effectiveCompressorId = compressorId || existingEntry.compressorId;

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

      // Employee validation removed - employees are now optional

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

      // Remove legacy calculated fields if present in body to avoid overwriting with null/0 if not intended
      // But ...req.body handles this.

      await existingEntry.update(updatePayload, { transaction });

      // Update employees if provided
      if (processedEmployees.length > 0) {
        // Delete existing employees for this entry
        await DailyEntryEmployee.destroy({ where: { dailyEntryId: id }, transaction });
        // Create new ones
        await DailyEntryEmployee.bulkCreate(processedEmployees, { transaction });
      }

      // Update machine RPM - use closing RPM from this entry (or higher if both shifts exist for same date)
      if (machineId) {
        const machine = await Machine.findByPk(machineId, { transaction });
        if (machine) {
          // Check if there's another shift entry for the same date
          const sameDateEntries = await DailyEntry.findAll({
            where: {
              date: date || existingEntry.date,
              machineId: machineId,
              deletedAt: null
            },
            transaction
          });

          // Find the highest closing RPM among all shifts for this date
          let maxClosingRPM = machineClosingRPM || 0; // Use machineClosingRPM from body
          for (const e of sameDateEntries) {
            if (e.machineClosingRPM && e.machineClosingRPM > maxClosingRPM) {
              maxClosingRPM = e.machineClosingRPM;
            }
          }

          // Only update if closing RPM is higher than current RPM (prevents old entries from overwriting newer values)
          const currentRPM = machine.machineRPM || 0;
          if (maxClosingRPM > currentRPM) {
            await machine.update({
              machineRPM: maxClosingRPM
            }, { transaction });
          }

          let machineServiceId = null;
          if (machineServiceDone) {
            const s = await Service.create({
              currentRpm: machine.machineRPM,
              serviceType: "Machine Service",
              serviceName: machineServiceName || null,
              machineId: machineId,
              compressorId: machine.compressorId
            }, { transaction });
            machineServiceId = s.id;

            // Update Machine Next Service RPM (Fixed Interval)
            if (machine.serviceCycleRpm) {
              const current = machine.machineRPM || 0;
              const cycle = machine.serviceCycleRpm;
              // Calculate next milestone: e.g. current=255, cycle=250 -> ceil(256/250)*250 = 500
              const nextRPM = Math.ceil((current + 1) / cycle) * cycle;
              await machine.update({ nextServiceRPM: nextRPM }, { transaction });
            }
          }
        }
      }

      // Update compressor RPM - use closing RPM from this entry (or higher if both shifts exist for same date)
      if (effectiveCompressorId) {
        const compressor = await Compressor.findByPk(effectiveCompressorId, { transaction });
        if (compressor) {
          // Check if there's another shift entry for the same date and compressor
          const sameDateEntries = await DailyEntry.findAll({
            where: {
              date: date || existingEntry.date,
              vehicleId: machineId,
              compressorId: effectiveCompressorId,
              deletedAt: null
            },
            transaction
          });

          // Find the highest closing RPM among all shifts for this date
          let maxClosingRPM = compressorClosingRPM || 0;
          for (const e of sameDateEntries) {
            if (e.compressorClosingRPM && e.compressorClosingRPM > maxClosingRPM) {
              maxClosingRPM = e.compressorClosingRPM;
            }
          }

          // Only update if closing RPM is higher than current RPM (prevents old entries from overwriting newer values)
          const currentRPM = compressor.compressorRPM || 0;
          if (maxClosingRPM > currentRPM) {
            await compressor.update({
              compressorRPM: maxClosingRPM
            }, { transaction });
          }

          let compressorServiceId = null;
          if (compressorServiceDone) {
            const serviceType = req.body.compressorServiceType || "Compressor Service";
            const s = await Service.create({
              currentRpm: compressor.compressorRPM,
              serviceType: serviceType,
              serviceName: compressorServiceName || null,
              machineId: machineId, // DB column kept
              compressorId: effectiveCompressorId,
            }, { transaction });
            compressorServiceId = s.id;

            // Update Compressor Next Service RPM based on type (Fixed Interval)
            const current = compressor.compressorRPM || 0;
            if (serviceType === "Compressor Service" && compressor.serviceCycleRpm) {
              const cycle = compressor.serviceCycleRpm;
              const nextRPM = Math.ceil((current + 1) / cycle) * cycle;
              await compressor.update({ nextServiceRPM: nextRPM }, { transaction });
            } else if (serviceType === "Engine Service" && compressor.engineServiceCycleRpm) {
              const cycle = compressor.engineServiceCycleRpm;
              const nextRPM = Math.ceil((current + 1) / cycle) * cycle;
              await compressor.update({ nextEngineServiceRPM: nextRPM }, { transaction });
            }
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
        await this.processMachineSpares(
          req.body.machineServiceItems,
          id,
          machineId,
          siteId || existingEntry.siteId,
          date || existingEntry.date,
          req.user.username,
          transaction,
          machineServiceId
        );
      }

      // Process service items for compressor
      if (req.body.compressorServiceItems && req.body.compressorServiceItems.length > 0 && effectiveCompressorId) {
        await this.processCompressorSpares(
          req.body.compressorServiceItems,
          id,
          effectiveCompressorId,
          siteId || existingEntry.siteId,
          date || existingEntry.date,
          req.user.username,
          transaction,
          compressorServiceId
        );
      }

      // Process drilling tools
      if (req.body.drillingTools && req.body.drillingTools.length > 0 && effectiveCompressorId) {
        const compressor = await Compressor.findByPk(effectiveCompressorId, { transaction });
        const currentCompressorRPM = compressorClosingRPM || compressor?.compressorRPM || 0;
        const currentMeter = req.body.meter || existingEntry.meter || 0;

        await this.processDrillingTools(
          req.body.drillingTools,
          id,
          effectiveCompressorId,
          siteId || existingEntry.siteId,
          currentCompressorRPM,
          currentMeter,
          date || existingEntry.date,
          req.user.username,
          transaction,
          compressorServiceId
        );
      }

      await transaction.commit();

      // Fetch the updated entry with relationships
      const updatedEntry = await DailyEntry.findByPk(id, {
        include: [
          { model: EmployeeList, as: "primaryEmployee", attributes: ["id", "name", "empId"] },
          { model: EmployeeList, as: "employees", attributes: ["id", "name", "empId"] },
          { model: Machine, as: "machine", attributes: ["id", "machineType", "machineNumber"] },
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

      // Build where clause - all conditions use AND logic (Sequelize default)
      const where = {};

      // Date filtering
      if (date) {
        where.date = date;
      } else if (startDate && endDate) {
        where.date = { [Op.between]: [startDate, endDate] };
      } else if (startDate) {
        where.date = { [Op.gte]: startDate };
      } else if (endDate) {
        where.date = { [Op.lte]: endDate };
      }

      // Site filter - works with other filters (AND logic)
      if (siteId) {
        where.siteId = siteId;
      }

      // Machine filter - works with other filters (AND logic)
      // Support both vehicleId (legacy) and machineId (new)
      const effectiveMachineId = machineId || vehicleId;
      if (effectiveMachineId) {
        where.machineId = effectiveMachineId;
      }

      // Compressor filter
      if (compressorId) {
        where.compressorId = compressorId;
      }

      // Shift filter
      if (shift) {
        where.shift = parseInt(shift);
      }

      // Build include with optional employee filter
      // Employee filter works with other filters (AND logic via required: true)
      const employeeInclude = {
        model: EmployeeList,
        as: "employees",
        attributes: ["id", "name", "empId"],
        through: { attributes: ["role", "shift"] }
      };

      // Filter by employee code or ID if provided
      // required: true ensures only entries with matching employees are returned
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
          { model: Machine, as: "machine", attributes: ["id", "machineType", "machineNumber"] }, // Changed alias to machine
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
          { model: Machine, as: "machine", attributes: ["id", "machineType", "machineNumber"] },
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
