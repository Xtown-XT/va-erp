import DailyEntry from "./dailyEntry.model.js";
import Machine from "../machine/machine.model.js";
import Compressor from "../compressor/compressor.model.js";
import Service from "../service/serviceHistory.model.js";
import EmployeeList from "../employee/employeeList.model.js";
import SiteStock from "../inventory/models/siteStock.model.js";
import DrillingToolItems from "../drillingTools/drillingToolItems.model.js";
import DrillingTools from "../drillingTools/drillingTools.model.js";
import EmployeeAttendance from "../employee/employeeAttendance.model.js";
import Site from "../site/site.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";
import DailyEntryEmployee from "./dailyEntryEmployee.model.js";
import { Op } from "sequelize";
import DrillingToolLog from "../drillingTools/drillingToolLog.model.js"; // Import needed for getFittedDrillingTools

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

  // Endpoint: Get fitted drilling tools
  // Returns tools that have been INSTALLED but not REMOVED (latest log status)
  getFittedDrillingTools = async (req, res, next) => {
    try {
      const { compressorId, machineId } = req.query;
      const where = {};

      // Filter logs by compressor/machine if provided
      // Note: Tools are fitted to a compressor or machine.
      if (compressorId) where.compressorId = compressorId;
      if (machineId) where.machineId = machineId;

      // Fetch all logs for relevant scope
      const logs = await DrillingToolLog.findAll({
        where: where,
        order: [['date', 'ASC'], ['createdAt', 'ASC']],
        include: [
          { model: DrillingTools, as: 'drillingTool', attributes: ['id', 'name', 'serialNumber'] }
        ]
      });

      // Compute status per tool - Aggregate quantity
      const toolMap = new Map(); // drillingToolId -> { log, netQuantity }

      logs.forEach(log => {
        const toolId = log.drillingToolId;
        const qty = log.quantity || 1;

        if (!toolMap.has(toolId)) {
          // Initialize with basic info from first encounter
          toolMap.set(toolId, {
            ...log.toJSON(),
            netQuantity: 0
          });
        }

        const entry = toolMap.get(toolId);

        if (log.action === 'INSTALL') {
          entry.netQuantity += qty;
          // Update with latest log details (since logs are ordered ASC, later logs overwrite early ones for metadata)
          Object.assign(entry, log.toJSON());
        } else if (log.action === 'REMOVE') {
          entry.netQuantity -= qty;
        }
      });

      const fittedTools = [];
      for (const [toolId, data] of toolMap.entries()) {
        if (data.netQuantity > 0) {
          fittedTools.push({
            ...data,
            quantity: data.netQuantity,
            status: 'FITTED',
            // Flatten for frontend
            itemServiceId: toolId,
            itemId: toolId,
            itemName: data.drillingTool?.name,
            partNumber: data.drillingTool?.partNumber
          });
        }
      }

      return res.json({ success: true, data: fittedTools });

    } catch (error) {
      next(error);
    }
  };

  //  READ ALL with filters
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, startDate, endDate, date, siteId, machineId, employeeId, vehicleId, compressorId, shift, empId } = req.query;

      const where = { deletedAt: null };

      // Date Range Filter
      if (date) {
        where.date = date;
      } else if (startDate && endDate) {
        where.date = { [Op.between]: [startDate, endDate] };
      } else if (startDate) {
        where.date = { [Op.gte]: startDate };
      } else if (endDate) {
        where.date = { [Op.lte]: endDate };
      }

      // Exact Filters
      if (siteId) where.siteId = siteId;

      const effectiveMachineId = machineId || vehicleId;
      if (effectiveMachineId) where.machineId = effectiveMachineId;

      if (compressorId) where.compressorId = compressorId;
      if (shift) where.shift = parseInt(shift);

      // Include configuration
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

      // Employee Filter logic
      // We search in the 'employees' association
      const empInclude = include.find(i => i.as === "employees");

      if (empId) {
        empInclude.where = { empId: { [Op.like]: `%${empId}%` } };
        empInclude.required = true;
      } else if (employeeId) {
        empInclude.where = { id: employeeId };
        empInclude.required = true;
      }

      const options = {
        where,
        include,
        distinct: true,
        order: [['date', 'DESC'], ['createdAt', 'DESC']]
      };

      // Use BaseCrud service but pass options
      const items = await this.service.getAll(page, limit, options);

      // Post-process items to format employees and ensure site consistency
      if (items.data) {
        items.data = items.data.map(item => {
          // Get site before toJSON to ensure it's preserved (Sequelize quirk handling)
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

  // Helper: Get last entry's closing RPM
  getLastEntryClosingRPM = async (machineId, compressorId, excludeEntryId = null, transaction = null) => {
    try {
      const where = {
        machineId: machineId,
        deletedAt: null
      };

      if (excludeEntryId) {
        where.id = { [Op.ne]: excludeEntryId };
      }

      const lastEntry = await DailyEntry.findOne({
        where,
        order: [['date', 'DESC'], ['createdAt', 'DESC']],
        transaction
      });

      if (!lastEntry) {
        return { machineClosingRPM: null, compressorClosingRPM: null };
      }

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

      const shift2Entry = sameDateEntries.find(e => e.shift === 2);
      const shift1Entry = sameDateEntries.find(e => e.shift === 1);

      if (shift2Entry) {
        machineClosingRPM = shift2Entry.machineClosingRPM;
        if (compressorId && shift2Entry.compressorId === compressorId) {
          compressorClosingRPM = shift2Entry.compressorClosingRPM;
        }
      } else if (shift1Entry) {
        machineClosingRPM = shift1Entry.machineClosingRPM;
        if (compressorId && shift1Entry.compressorId === compressorId) {
          compressorClosingRPM = shift1Entry.compressorClosingRPM;
        }
      }

      if (shift1Entry && shift2Entry) {
        machineClosingRPM = Math.max(shift1Entry.machineClosingRPM || 0, shift2Entry.machineClosingRPM || 0);
        if (compressorId) {
          compressorClosingRPM = Math.max(shift1Entry.compressorClosingRPM || 0, shift2Entry.compressorClosingRPM || 0);
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

  // Helper: Upsert attendance
  upsertEmployeeAttendance = async (employees, siteId, machineId, date, username, transaction) => {
    try {
      for (const emp of employees) {
        const employeeId = emp.employeeId;
        const existingAttendance = await EmployeeAttendance.findOne({
          where: { employeeId, date },
          transaction
        });

        if (existingAttendance) {
          await existingAttendance.update({
            presence: 'present',
            workStatus: 'working',
            siteId,
            machineId,
            updatedBy: username
          }, { transaction });
        } else {
          await EmployeeAttendance.create({
            employeeId,
            date,
            presence: 'present',
            workStatus: 'working',
            salary: 0,
            siteId,
            machineId,
            createdBy: username
          }, { transaction });
        }
      }
    } catch (error) {
      console.error('Error upserting employee attendance:', error);
      throw error;
    }
  };

  // Helper: Process generic service
  processService = async (params) => {
    const {
      entityType, entityId, serviceName, date, currentRpm, siteId,
      spares = [], username, transaction, dailyEntryId
    } = params;

    const serviceHistory = await Service.create({
      entityType,
      entityId,
      serviceType: serviceName, // Use name as type string
      serviceName: serviceName, // Redundant but clear
      date,
      currentRPM: currentRpm,
      siteId,
      sparesUsed: spares,
      createdBy: username,
      dailyEntryId
    }, { transaction });

    for (const item of spares) {
      if (!item.itemId || !item.quantity) continue;
      const stock = await SiteStock.findOne({
        where: { siteId, spareId: item.itemId },
        transaction
      });

      if (!stock || stock.quantity < item.quantity) {
        throw new Error(`Insufficient stock for spare ID ${item.itemId}`);
      }
      await stock.decrement('quantity', { by: item.quantity, transaction });
    }

    // Update Maintenance Config
    if (entityType === 'MACHINE') {
      const machine = await Machine.findByPk(entityId, { transaction });
      if (machine) {
        let config = machine.maintenanceConfig || [];
        if (!Array.isArray(config)) config = [];

        const index = config.findIndex(c => c.name === serviceName);
        if (index >= 0) {
          config[index].lastServiceRPM = Number(currentRpm);
          // Clone to trigger update
          machine.set('maintenanceConfig', [...config]);
          await machine.save({ transaction });
        }
      }
    } else {
      const compressor = await Compressor.findByPk(entityId, { transaction });
      if (compressor) {
        let config = compressor.maintenanceConfig || [];
        if (!Array.isArray(config)) config = [];

        const index = config.findIndex(c => c.name === serviceName);
        if (index >= 0) {
          config[index].lastServiceRPM = Number(currentRpm);
          compressor.set('maintenanceConfig', [...config]);
          await compressor.save({ transaction });
        }
      }
    }
    return serviceHistory;
  };

  // Helper: Process drilling tools
  processDrillingTools = async (drillingTools, dailyEntryId, compressorId, machineId, siteId, date, username, transaction) => {
    if (!drillingTools || drillingTools.length === 0) return;

    // Pre-fetch all tool definitions to check copyRpm setting
    const toolIds = drillingTools.map(t => t.toolId);
    const toolDefs = await DrillingTools.findAll({
      where: { id: toolIds },
      attributes: ['id', 'copyRpm'],
      transaction
    });
    const toolDefMap = new Map(toolDefs.map(td => [td.id, td.copyRpm]));

    for (const tool of drillingTools) {
      const logDate = tool.date || date;
      const qty = tool.quantity || 1;

      const copySetting = toolDefMap.get(tool.toolId);
      let logRPM = 0;

      if (copySetting === 'machine') {
        logRPM = tool.currentMachineRPM || 0;
      } else if (copySetting === 'compressor') {
        logRPM = tool.currentCompressorRPM || 0;
      }

      await DrillingToolLog.create({
        drillingToolId: tool.toolId,
        siteId,
        machineId,
        action: tool.action,
        date: logDate,
        quantity: qty,
        currentMachinePRM: logRPM,
        currentMachineMeter: tool.currentMachineMeter || 0,
        createdBy: username,
        dailyEntryId
      }, { transaction });

      const stock = await SiteStock.findOne({
        where: { siteId, drillingToolId: tool.toolId },
        transaction
      });

      if (tool.action === 'INSTALL') {
        if (stock && stock.quantity > 0) {
          await stock.decrement('quantity', { by: qty, transaction });
        }
      }
    }
  };

  create = async (req, res, next) => {
    console.log("DEBUG: DailyEntry Create Body:", JSON.stringify(req.body, null, 2));
    const transaction = await DailyEntry.sequelize.transaction();
    try {
      const {
        vehicleId,
        machineId: reqMachineId,
        vehicleOpeningRPM, vehicleClosingRPM,
        machineOpeningRPM, machineClosingRPM,
        compressorId, compressorOpeningRPM, compressorClosingRPM,
        vehicleServiceDone, vehicleServiceName,
        machineServiceDone, machineServiceName,
        compressorServiceDone, compressorServiceName,
        employeeId,
        employees = [],
        additionalEmployeeIds = [],
        notes,
        compressorHSD,
        shift = 1,
        date,
        siteId
      } = req.body;
      const machineId = reqMachineId || vehicleId;

      const finalMachineOpeningRPM = machineOpeningRPM !== undefined ? machineOpeningRPM : vehicleOpeningRPM;
      const finalMachineClosingRPM = machineClosingRPM !== undefined ? machineClosingRPM : vehicleClosingRPM;

      const refNo = req.body.refNo || await this.generateRefNo();

      // Handle employees
      let processedEmployees = [];
      let primaryEmployeeId = null;
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
        const entryShiftOperator = employees.find(e => (e.shift || shift) === shift && e.role === 'operator');
        primaryEmployeeId = entryShiftOperator ? entryShiftOperator.employeeId : (processedEmployees[0]?.employeeId || null);
      } else if (employeeId) {
        processedEmployees = [{ dailyEntryId: null, employeeId, role: 'operator', shift: shift }];
        primaryEmployeeId = employeeId;
        if (additionalEmployeeIds && additionalEmployeeIds.length > 0) {
          additionalEmployeeIds.forEach((eid, index) => {
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
      }

      // Create entry
      const entryPayload = {
        ...req.body,
        id: undefined,
        refNo,
        shift: shift || 1,
        employeeId: primaryEmployeeId,
        notes: notes || null,
        compressorId: compressorId || null,
        compressorHSD: compressorHSD || null,
        createdBy: req.user.username,
        machineOpeningRPM: finalMachineOpeningRPM,
        machineClosingRPM: finalMachineClosingRPM
      };

      const entry = await DailyEntry.create(entryPayload, { transaction });

      // Create employees
      if (processedEmployees.length) {
        const rows = processedEmployees.map(emp => ({ ...emp, dailyEntryId: entry.id }));
        await DailyEntryEmployee.bulkCreate(rows, { transaction });
      }

      // Update machine RPM
      const machine = await Machine.findByPk(machineId, { transaction });
      if (machine) {
        const sameDateEntries = await DailyEntry.findAll({
          where: { date: entry.date, machineId: machineId, deletedAt: null },
          transaction
        });
        let maxClosingRPM = finalMachineClosingRPM || 0;
        for (const e of sameDateEntries) {
          const closing = e.machineClosingRPM !== null ? e.machineClosingRPM : (e.vehicleClosingRPM || 0);
          if (closing && closing > maxClosingRPM) maxClosingRPM = closing;
        }
        if (maxClosingRPM > (machine.machineRPM || 0)) {
          await machine.update({ machineRPM: maxClosingRPM }, { transaction });
        }

        if (req.body.machineServiceDone) {
          await this.processService({
            entityType: 'MACHINE',
            entityId: machineId,
            serviceName: req.body.machineServiceName || 'General Service',
            date: entry.date,
            currentRpm: maxClosingRPM,
            siteId,
            spares: req.body.machineGeneralSpares || [],
            username: req.user.username,
            transaction,
            dailyEntryId: entry.id
          });
        }
        if (req.body.machineEngineServiceDone) {
          // If separate engine service logic is still needed, treat as another service call
          // But new logic prefers just 'serviceName'.
          // We will map 'machineEngineServiceDone' to a service call if 'machineEngineServiceName' is provided, 
          // OR fallback to 'Engine Oil Service' for backward compat?
          // Better: Frontend should just send `machineServiceDone` and the selected name.
          // But to support existing frontend or mixed calls, let's keep it.
          await this.processService({
            entityType: 'MACHINE',
            entityId: machineId,
            serviceName: req.body.machineEngineServiceName || 'Engine Service',
            date: entry.date,
            currentRpm: maxClosingRPM,
            siteId,
            spares: req.body.machineEngineSpares || [],
            username: req.user.username,
            transaction,
            dailyEntryId: entry.id
          });
        }
      }

      // Update compressor RPM
      if (compressorId) {
        const compressor = await Compressor.findByPk(compressorId, { transaction });
        if (compressor) {
          const sameDateEntries = await DailyEntry.findAll({
            where: { date: entry.date, compressorId: compressorId, deletedAt: null },
            transaction
          });
          let maxClosingRPM = compressorClosingRPM || 0;
          for (const e of sameDateEntries) {
            if (e.compressorClosingRPM && e.compressorClosingRPM > maxClosingRPM) maxClosingRPM = e.compressorClosingRPM;
          }
          if (maxClosingRPM > (compressor.compressorRPM || 0)) {
            await compressor.update({ compressorRPM: maxClosingRPM }, { transaction });
          }

          if (req.body.compressorServiceDone) {
            await this.processService({
              entityType: 'COMPRESSOR',
              entityId: compressorId,
              serviceName: req.body.compressorServiceName || 'General Service',
              date: entry.date,
              currentRpm: maxClosingRPM,
              siteId,
              spares: req.body.compressorGeneralSpares || [],
              username: req.user.username,
              transaction,
              dailyEntryId: entry.id
            });
          }
          if (req.body.compressorEngineServiceDone) {
            await this.processService({
              entityType: 'COMPRESSOR',
              entityId: compressorId,
              serviceName: req.body.compressorEngineServiceName || 'Engine Service',
              date: entry.date,
              currentRpm: maxClosingRPM,
              siteId,
              spares: req.body.compressorEngineSpares || [],
              username: req.user.username,
              transaction,
              dailyEntryId: entry.id
            });
          }
        }
      }

      // Attendance
      if (processedEmployees.length > 0) {
        await this.upsertEmployeeAttendance(
          processedEmployees, siteId, machineId, date || entry.date, req.user.username, transaction
        );
      }

      // Drilling Tools
      if (req.body.drillingTools && req.body.drillingTools.length > 0) {
        const machineRPM = finalMachineClosingRPM || 0;
        const compressorRPM = compressorClosingRPM || 0;
        await this.processDrillingTools(
          req.body.drillingTools.map(t => ({
            ...t,
            currentMachineRPM: machineRPM,
            currentCompressorRPM: compressorRPM,
            currentMachineMeter: req.body.machineEndMeter || 0
          })),
          entry.id, compressorId, machineId, siteId, entry.date, req.user.username, transaction
        );
      }

      await transaction.commit();

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
      if (transaction) await transaction.rollback();
      next(error);
    }
  };

  update = async (req, res, next) => {
    let transaction;
    try {
      transaction = await DailyEntry.sequelize.transaction();
      const { id } = req.params;
      const {
        date, shift, machineId, compressorId,
        machineOpeningRPM, machineClosingRPM,
        compressorOpeningRPM, compressorClosingRPM,
        machineHSD, compressorHSD, dieselUsed,
        noOfHoles, meter, notes,
        employees
      } = req.body;

      const existingEntry = await DailyEntry.findByPk(id, { transaction });
      if (!existingEntry) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "DailyEntry not found" });
      }

      // === 1. Revert Old Service History (Restore Spares Stock) ===
      const oldServices = await Service.findAll({ where: { dailyEntryId: id }, transaction });
      for (const svc of oldServices) {
        if (svc.sparesUsed && svc.sparesUsed.length > 0) {
          for (const spare of svc.sparesUsed) {
            // Restore stock for each spare used
            if (spare.itemId && spare.quantity) {
              const stock = await SiteStock.findOne({
                where: { siteId: svc.siteId, spareId: spare.itemId },
                transaction
              });
              if (stock) {
                await stock.increment('quantity', { by: spare.quantity, transaction });
              }
            }
          }
        }
        await svc.destroy({ transaction });
      }

      // === 2. Revert Old Drilling Tools (Restore Tool Stock) ===
      const oldLogs = await DrillingToolLog.findAll({ where: { dailyEntryId: id }, transaction });
      for (const log of oldLogs) {
        if (log.action === 'INSTALL') {
          // If it was installed, we deducted stock. Now put it back.
          const stock = await SiteStock.findOne({
            where: { siteId: log.siteId, drillingToolId: log.drillingToolId },
            transaction
          });
          if (stock) {
            await stock.increment('quantity', { by: log.quantity, transaction });
          }
        }
        // If REMOVE, we assume it went to "Loose/Broken" or wasn't added back to stock in original logic,
        // so we don't reverse anything stock-wise (unless we change Remove logic too).
        // For now, mirroring create logic: only INSTALL affects stock.
        await log.destroy({ transaction });
      }

      // === 3. Update Entry Basic Fields ===
      // Note: We use the values from req.body, falling back to existing if undefined?
      // actually update() will set them.
      await existingEntry.update({
        date, shift, machineId, compressorId,
        machineOpeningRPM, machineClosingRPM,
        compressorOpeningRPM, compressorClosingRPM,
        machineHSD, compressorHSD, dieselUsed,
        noOfHoles, meter, notes
      }, { transaction });

      // === 4. Update Employees ===
      if (employees && employees.length > 0) {
        const processedEmployees = employees.map(emp => ({
          dailyEntryId: id,
          employeeId: emp.employeeId,
          role: emp.role || 'operator',
          shift: emp.shift || shift || 1
        }));
        await DailyEntryEmployee.destroy({ where: { dailyEntryId: id }, transaction });
        await DailyEntryEmployee.bulkCreate(processedEmployees, { transaction });

        // We do NOT update attendance here based on user request ("ignore attendance employee always in 1 site")
        // But we might want to ensure they are at least marked present? 
        // User said "ignore attendance", so we leave existing logic or skip?
        // Original logic called upsertEmployeeAttendance.
        // User request: "ignore attendance employee always in 1 site" -> implies don't worry about the overwrite bug.
        // So we KEEP the upsert call to ensure attendance is recorded.
        await this.upsertEmployeeAttendance(
          processedEmployees, existingEntry.siteId, machineId || existingEntry.machineId,
          date || existingEntry.date, req.user.username, transaction
        );
      }

      // === 5. Apply New Services (Consume Spares) ===
      const siteId = existingEntry.siteId; // Site shouldn't change typically, or we use new siteId if updated
      // But update above updated existingEntry.
      // Note: If siteId changed, existingEntry.siteId is new siteId.

      // Machine Services
      const effectiveMachineId = machineId || existingEntry.machineId;
      if (effectiveMachineId) {
        // Update Machine RPM Max
        const machine = await Machine.findByPk(effectiveMachineId, { transaction });
        if (machine) {
          const newClosing = existingEntry.machineClosingRPM || 0;
          if (newClosing > (machine.machineRPM || 0)) {
            await machine.update({ machineRPM: newClosing }, { transaction });
          }
        }

        if (req.body.machineServiceDone) {
          await this.processService({
            entityType: 'MACHINE',
            entityId: effectiveMachineId,
            serviceName: req.body.machineServiceName || 'General Service',
            date: existingEntry.date,
            currentRpm: existingEntry.machineClosingRPM,
            siteId,
            spares: req.body.machineGeneralSpares || [],
            username: req.user.username,
            transaction,
            dailyEntryId: id
          });
        }
        if (req.body.machineEngineServiceDone) {
          await this.processService({
            entityType: 'MACHINE',
            entityId: effectiveMachineId,
            serviceName: req.body.machineEngineServiceName || 'Engine Service',
            date: existingEntry.date,
            currentRpm: existingEntry.machineClosingRPM,
            siteId,
            spares: req.body.machineEngineSpares || [],
            username: req.user.username,
            transaction,
            dailyEntryId: id
          });
        }
      }

      // Compressor Services
      const effectiveCompressorId = compressorId || existingEntry.compressorId;
      if (effectiveCompressorId) {
        const compressor = await Compressor.findByPk(effectiveCompressorId, { transaction });
        if (compressor) {
          const newClosing = existingEntry.compressorClosingRPM || 0;
          if (newClosing > (compressor.compressorRPM || 0)) {
            await compressor.update({ compressorRPM: newClosing }, { transaction });
          }
        }

        if (req.body.compressorServiceDone) {
          await this.processService({
            entityType: 'COMPRESSOR',
            entityId: effectiveCompressorId,
            serviceName: req.body.compressorServiceName || 'General Service',
            date: existingEntry.date,
            currentRpm: existingEntry.compressorClosingRPM,
            siteId,
            spares: req.body.compressorGeneralSpares || [],
            username: req.user.username,
            transaction,
            dailyEntryId: id
          });
        }
        if (req.body.compressorEngineServiceDone) {
          await this.processService({
            entityType: 'COMPRESSOR',
            entityId: effectiveCompressorId,
            serviceName: req.body.compressorEngineServiceName || 'Engine Service',
            date: existingEntry.date,
            currentRpm: existingEntry.compressorClosingRPM,
            siteId,
            spares: req.body.compressorEngineSpares || [],
            username: req.user.username,
            transaction,
            dailyEntryId: id
          });
        }
      }

      // === 6. Apply New Drilling Tools ===
      if (req.body.drillingTools && req.body.drillingTools.length > 0) {
        const machineRPM = existingEntry.machineClosingRPM || 0;
        const compressorRPM = existingEntry.compressorClosingRPM || 0;
        await this.processDrillingTools(
          req.body.drillingTools.map(t => ({
            ...t,
            currentMachineRPM: machineRPM,
            currentCompressorRPM: compressorRPM,
            currentMachineMeter: existingEntry.meter || 0
          })),
          id, effectiveCompressorId, effectiveMachineId, siteId, existingEntry.date, req.user.username, transaction
        );
      }

      await transaction.commit();

      const updatedEntry = await DailyEntry.findByPk(id, {
        include: [
          { model: EmployeeList, as: "employees" },
          { model: Machine, as: "machine" },
          { model: Site, as: "site" }
        ]
      });

      return res.json({ success: true, message: "DailyEntry updated successfully", data: updatedEntry });

    } catch (error) {
      if (transaction) await transaction.rollback();
      next(error);
    }
  };
}

export const DailyEntryController = new DailyEntryCustomController(
  DailyEntryCrud,
  "DailyEntry"
);
