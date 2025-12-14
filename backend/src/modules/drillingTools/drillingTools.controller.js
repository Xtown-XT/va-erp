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

        // Calculate run meter
        const runMeter = (removedMeter || 0) - (installation.fittedMeter || 0);

        await installation.update({
            removedDate,
            removedRPM,
            removedMeter,
            status: 'COMPLETED',
            // Update accumulated one last time if we rely on removedMeter
            // But we were updating it daily. 
            // If we trust daily entry, currentAccumulatedMeter is up to date.
            // If we trust removedMeter, we might want to reconcile.
            // Let's assume Daily Entry kept it mostly up to date, but removedMeter is the final truth?
            // User said: "Removed - Fitted"
            // Let's NOT overwrite accumulatedMeter here to avoid conflict with daily entries, 
            // unless we want to enforce consistency.
            // For now just close it.
        }, { transaction: t });

        // NOTE: Stock is NOT incremented upon removal (assumed used/broken).

        await t.commit();
        return res.json({ success: true, message: "Tool Removed", data: installation });
    } catch (error) {
        await t.rollback();
        next(error);
    }
};

export const DrillingToolsController = controller;
