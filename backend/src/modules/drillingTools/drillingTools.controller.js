import DrillingTools from "./drillingTools.model.js";
import DrillingToolItems from "./drillingToolItems.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";

const DrillingToolsCrud = new BaseCrud(DrillingTools);

const controller = new BaseController(DrillingToolsCrud, "DrillingTools");

const { Op } = await import("sequelize");

controller.getAll = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const where = {};

        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { partNumber: { [Op.like]: `%${search}%` } }
            ];
        }

        const items = await DrillingToolsCrud.getAll(page, limit, { where });
        return res.json({ success: true, ...items });
    } catch (error) {
        next(error);
    }
};

controller.getInstances = async (req, res, next) => {
    try {
        const { status, siteId } = req.query;
        console.log("DrillingTools.getInstances Query:", req.query);
        const where = {};
        if (status) where.status = status;
        if (siteId) where.siteId = siteId;

        console.log("DrillingTools.getInstances Where:", where);

        const instances = await DrillingToolItems.findAll({
            where,
            include: [
                { model: DrillingTools, as: "catalogItem" }
            ]
        });
        console.log("DrillingTools.getInstances Found:", instances.length);

        return res.json({
            success: true,
            data: instances,
            message: "Fetched Tool Instances"
        });
    } catch (error) {
        next(error);
    }
};

controller.createInstance = async (req, res, next) => {
    try {
        const { drillingToolId, serialNumber, initialRPM, initialMeter } = req.body;

        // Check if serial number exists
        const existing = await DrillingToolItems.findOne({ where: { serialNumber } });
        if (existing) {
            return res.status(400).json({ success: false, message: "Serial Number already exists" });
        }

        const instance = await DrillingToolItems.create({
            drillingToolId,
            serialNumber,
            currentRpm: initialRPM || 0,
            currentMeter: initialMeter || 0,
            status: 'In Stock'
        });

        return res.status(201).json({
            success: true,
            message: "Tool Instance Created Successfully",
            data: instance
        });
    } catch (error) {
        next(error);
    }
};


controller.installTool = async (req, res, next) => {
    const t = await DrillingTools.sequelize.transaction();
    try {
        const { machineId, drillingToolId, siteId, fittedDate, fittedRPM, fittedMeter } = req.body;

        // 1. Check Site Stock
        const stock = await import("../inventory/models/siteStock.model.js").then(m => m.default.findOne({
            where: { siteId, drillingToolId },
            transaction: t
        }));

        if (!stock || stock.quantity < 1) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "Insufficient stock for this tool at the site." });
        }

        // 2. Create Installation
        const DrillingToolInstallation = await import("./drillingToolInstallation.model.js").then(m => m.default);
        const installation = await DrillingToolInstallation.create({
            drillingToolId,
            machineId,
            siteId,
            fittedDate,
            fittedRPM,
            fittedMeter,
            status: 'ACTIVE',
            initialAccumulatedMeter: 0, // Assuming new or we need to pass previous history? For now 0.
            currentAccumulatedMeter: 0
        }, { transaction: t });

        // 3. Decrement Stock
        await stock.decrement('quantity', { by: 1, transaction: t });

        await t.commit();
        return res.status(201).json({ success: true, message: "Tool Installed", data: installation });
    } catch (error) {
        await t.rollback();
        next(error);
    }
};

controller.removeTool = async (req, res, next) => {
    const t = await DrillingTools.sequelize.transaction();
    try {
        const { installationId, removedDate, removedRPM, removedMeter } = req.body;

        const DrillingToolInstallation = await import("./drillingToolInstallation.model.js").then(m => m.default);
        const installation = await DrillingToolInstallation.findByPk(installationId, { transaction: t });

        if (!installation) {
            await t.rollback();
            return res.status(404).json({ success: false, message: "Installation not found" });
        }

        // Accumulate meter before closing
        // removedMeter from body is treated as the current shift's run
        const currentShiftMeter = Number(removedMeter) || 0;
        const finalAccumulated = (installation.accumulatedMeter || 0) + currentShiftMeter;

        await installation.update({
            removedDate,
            removedRPM,
            removedMeter: finalAccumulated, // Store total accumulated
            accumulatedMeter: finalAccumulated, // Update reference
            status: 'COMPLETED',
        }, { transaction: t });

        // NOTE: Stock is NOT incremented upon removal (assumed used/broken).

        await t.commit();
        return res.json({ success: true, message: "Tool Removed", data: installation });
    } catch (error) {
        await t.rollback();
        next(error);
    }
};

// Report: Machine-wise drilling tools usage
controller.getMachineWiseReport = async (req, res, next) => {
    try {
        const { startDate, endDate, machineId, siteId } = req.query;
        const Machine = await import("../machine/machine.model.js").then(m => m.default);
        const Site = await import("../site/site.model.js").then(m => m.default);
        const DrillingToolInstallation = await import("./drillingToolInstallation.model.js").then(m => m.default);

        const where = {};
        if (startDate) where.fittedDate = { [Op.gte]: startDate };
        if (endDate) {
            where.fittedDate = where.fittedDate || {};
            where.fittedDate[Op.lte] = endDate;
        }
        if (machineId) where.machineId = machineId;
        if (siteId) where.siteId = siteId;

        const installations = await DrillingToolInstallation.findAll({
            where,
            include: [
                { model: DrillingTools, as: 'drillingTool', attributes: ['id', 'name', 'partNumber', 'rpmSource'] },
                { model: Machine, as: 'machine', attributes: ['id', 'machineType', 'machineNumber'] },
                { model: Site, as: 'site', attributes: ['id', 'siteName'] }
            ],
            order: [['fittedDate', 'DESC']]
        });

        const report = installations.map(inst => ({
            installationId: inst.id,
            toolName: inst.drillingTool?.name,
            partNumber: inst.drillingTool?.partNumber,
            rpmSource: inst.drillingTool?.rpmSource,
            machine: `${inst.machine?.machineType} ${inst.machine?.machineNumber}`,
            machineId: inst.machineId,
            site: inst.site?.siteName,
            siteId: inst.siteId,
            fittedDate: inst.fittedDate,
            fittedRPM: inst.fittedRPM,
            removedDate: inst.removedDate,
            removedRPM: inst.removedRPM,
            accumulatedMeter: inst.accumulatedMeter || 0,
            status: inst.status
        }));

        return res.json({ success: true, data: report, total: report.length });
    } catch (error) {
        next(error);
    }
};

// Report: Site-wise drilling tools usage
controller.getSiteWiseReport = async (req, res, next) => {
    try {
        const { startDate, endDate, siteId, machineId } = req.query;
        const Machine = await import("../machine/machine.model.js").then(m => m.default);
        const Site = await import("../site/site.model.js").then(m => m.default);
        const DrillingToolInstallation = await import("./drillingToolInstallation.model.js").then(m => m.default);

        const where = {};
        if (startDate) where.fittedDate = { [Op.gte]: startDate };
        if (endDate) {
            where.fittedDate = where.fittedDate || {};
            where.fittedDate[Op.lte] = endDate;
        }
        if (siteId) where.siteId = siteId;
        if (machineId) where.machineId = machineId;

        const installations = await DrillingToolInstallation.findAll({
            where,
            include: [
                { model: DrillingTools, as: 'drillingTool', attributes: ['id', 'name', 'partNumber', 'rpmSource'] },
                { model: Machine, as: 'machine', attributes: ['id', 'machineType', 'machineNumber'] },
                { model: Site, as: 'site', attributes: ['id', 'siteName'] }
            ],
            order: [['siteId', 'ASC'], ['fittedDate', 'DESC']]
        });

        const report = installations.map(inst => ({
            installationId: inst.id,
            toolName: inst.drillingTool?.name,
            partNumber: inst.drillingTool?.partNumber,
            rpmSource: inst.drillingTool?.rpmSource,
            site: inst.site?.siteName,
            siteId: inst.siteId,
            machine: `${inst.machine?.machineType} ${inst.machine?.machineNumber}`,
            machineId: inst.machineId,
            fittedDate: inst.fittedDate,
            fittedRPM: inst.fittedRPM,
            removedDate: inst.removedDate,
            removedRPM: inst.removedRPM,
            accumulatedMeter: inst.accumulatedMeter || 0,
            status: inst.status
        }));

        return res.json({ success: true, data: report, total: report.length });
    } catch (error) {
        next(error);
    }
};

export const DrillingToolsController = controller;
