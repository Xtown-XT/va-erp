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

export const DrillingToolsController = controller;
