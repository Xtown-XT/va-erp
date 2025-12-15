import ServiceHistory from "./models/serviceHistory.model.js";
import ServiceItem from "./models/serviceItem.model.js";
import Machine from "../machine/machine.model.js";
import Compressor from "../compressor/compressor.model.js";
import SiteStock from "../inventory/models/siteStock.model.js";
import DrillingToolItems from "../drillingTools/drillingToolItems.model.js";
import DrillingTools from "../drillingTools/drillingTools.model.js";
import sequelize from "../../config/db.js";
import { BaseController } from "../../shared/utils/baseController.js";

class ServiceController extends BaseController {
    constructor() {
        super(ServiceHistory);
    }

    createServiceEntry = async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const {
                machineId,
                compressorId,
                serviceDate,
                serviceName, // e.g., "Hydraulic Oil"
                serviceType, // Keep for backward compatibility or general categorization if needed
                remarks,
                currentRpm,
                usedItems, // Array of { itemType: 'spare'|'drillingTool', itemId: uuid, quantity: int }
                siteId // Required to know where to deduce stock from
            } = req.body;

            // Create History Record
            const service = await ServiceHistory.create({
                machineId: machineId || null,
                compressorId: compressorId || null,
                serviceDate,
                serviceName,
                serviceType: serviceName || serviceType || 'General',
                remarks,
                currentRpm,
                siteId: siteId || null,
                sparesUsed: usedItems // Store raw used items JSON for quick reference
            }, { transaction: t });

            // Process Items
            if (usedItems && usedItems.length > 0) {
                for (const item of usedItems) {
                    // Create Service Item Record
                    await ServiceItem.create({
                        serviceHistoryId: service.id,
                        itemType: item.itemType,
                        spareId: item.itemType === 'spare' ? item.itemId : null,
                        drillingToolItemId: item.itemType === 'drillingTool' ? item.itemId : null, // Instance ID
                        quantity: item.quantity || 1
                    }, { transaction: t });

                    // Decrement Stock / Update Status
                    if (item.itemType === 'spare') {
                        const stock = await SiteStock.findOne({
                            where: { siteId, spareId: item.itemId },
                            transaction: t
                        });

                        if (!stock || stock.quantity < item.quantity) {
                            throw new Error(`Insufficient stock in site for spare ID: ${item.itemId}`);
                        }
                        await stock.decrement('quantity', { by: item.quantity, transaction: t });
                    } else if (item.itemType === 'drillingTool') {
                        // For drilling tool, we are FITTING an instance.
                        const toolInstance = await DrillingToolItems.findByPk(item.itemId, { transaction: t });
                        if (!toolInstance) throw new Error("Tool instance not found");

                        // Update instance location/status
                        // If fitting to machine
                        if (machineId) {
                            await toolInstance.update({
                                fittedMachineId: machineId,
                                siteId: siteId, // It moves to the site of fitting (or stays)
                                status: 'Fitted'
                            }, { transaction: t });
                        }
                        // Similarly for compressor
                        if (compressorId) {
                            await toolInstance.update({
                                fittedCompressorId: compressorId,
                                siteId,
                                status: 'Fitted'
                            }, { transaction: t });
                        }
                    }
                }
            }

            // Update Maintenance Config on Asset
            if (machineId && currentRpm && serviceName) {
                const machine = await Machine.findByPk(machineId, { transaction: t });
                if (machine) {
                    let config = machine.maintenanceConfig || [];
                    if (typeof config === 'string') {
                        try { config = JSON.parse(config); } catch (e) { config = []; }
                    }
                    // Ensure config is an array (handle legacy null/undefined)
                    if (!Array.isArray(config)) config = [];

                    const configIndex = config.findIndex(c => c.name === serviceName);

                    if (configIndex >= 0) {
                        // Update existing service type
                        config[configIndex].lastServiceRPM = Number(currentRpm);
                        // We don't change the cycle, just the last service RPM
                    } else {
                        // Optional: Auto-create if not found? 
                        // For now, let's assume it must exist, or we ignore it. 
                        // But user said "user can create service names", so maybe we add it if it's new?
                        // Let's safe-guard: if it doesn't exist in config, we don't track its next alert for now.
                        // OR we add it with a default cycle? better to not pollute config with typos.
                        // Checking if 'serviceCycleRpm' exists in payload could be useful for ad-hoc creation.
                        // For now, only update if exists.
                    }

                    // Sequelize JSON update requirement: clone array to trigger change detection
                    machine.set('maintenanceConfig', [...config]);
                    await machine.save({ transaction: t });
                }
            }

            if (compressorId && currentRpm && serviceName) {
                const compressor = await Compressor.findByPk(compressorId, { transaction: t });
                if (compressor) {
                    const currentRPM = compressor.compressorRPM || 0;
                    let config = compressor.maintenanceConfig || [];
                    if (typeof config === 'string') {
                        try { config = JSON.parse(config); } catch (e) { config = []; }
                    }
                    if (!Array.isArray(config)) config = [];

                    const configIndex = config.findIndex(c => c.name === serviceName);
                    if (configIndex >= 0) {
                        config[configIndex].lastServiceRPM = Number(currentRpm);
                        // Sequelize JSON update
                        compressor.set('maintenanceConfig', [...config]);
                        await compressor.save({ transaction: t });
                    }
                }
            }

            await t.commit();
            return res.status(201).json({ success: true, message: "Service Entry Created", data: service });
        } catch (error) {
            await t.rollback();
            return res.status(500).json({ success: false, message: error.message });
        }
    };

    getServiceHistory = async (req, res) => {
        try {
            const { machineId, compressorId } = req.query;
            const where = {};
            if (machineId) where.machineId = machineId;
            if (compressorId) where.compressorId = compressorId;

            const history = await ServiceHistory.findAll({
                where,
                include: [
                    {
                        model: ServiceItem,
                        as: 'items',
                        include: ['spare', 'drillingToolItem']
                    }
                ],
                order: [['serviceDate', 'DESC']]
            });
            return res.json({ success: true, message: "Fetched Service History", data: history });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    };

    // Get Service Alerts based on maintenanceConfig
    getServiceAlerts = async (req, res) => {
        try {
            const alerts = [];

            // Check Machines
            const machines = await Machine.findAll({
                attributes: ['id', 'machineNumber', 'machineRPM', 'maintenanceConfig'],
                where: { status: 'active' }
            });

            for (const machine of machines) {
                const currentRPM = machine.machineRPM || 0;
                let config = machine.maintenanceConfig || [];
                if (typeof config === 'string') {
                    try { config = JSON.parse(config); } catch (e) { config = []; }
                }

                if (Array.isArray(config)) {
                    for (const item of config) {
                        if (!item.cycle) continue; // Skip if no cycle defined
                        const lastService = item.lastServiceRPM || 0;
                        const nextService = lastService + Number(item.cycle);
                        const remaining = nextService - currentRPM;

                        // Alert if within 50 RPM or Overdue
                        if (remaining <= 50) {
                            alerts.push({
                                type: 'machine',
                                assetId: machine.id,
                                name: machine.machineNumber,
                                serviceName: item.name,
                                message: `Service '${item.name}' due at ${nextService} RPM (Current: ${currentRPM})`,
                                severity: remaining <= 0 ? 'high' : 'medium',
                                remainingRPM: remaining
                            });
                        }
                    }
                }
            }

            // Check Compressors
            const compressors = await Compressor.findAll({
                attributes: ['id', 'compressorName', 'compressorRPM', 'maintenanceConfig'],
                where: { status: 'active' }
            });

            for (const compressor of compressors) {
                const currentRPM = compressor.compressorRPM || 0;
                const config = compressor.maintenanceConfig || [];

                if (Array.isArray(config)) {
                    for (const item of config) {
                        if (!item.cycle) continue;
                        const lastService = item.lastServiceRPM || 0;
                        const nextService = lastService + Number(item.cycle);
                        const remaining = nextService - currentRPM;

                        if (remaining <= 50) {
                            alerts.push({
                                type: 'compressor',
                                assetId: compressor.id,
                                name: compressor.compressorName,
                                serviceName: item.name,
                                message: `Service '${item.name}' due at ${nextService} RPM (Current: ${currentRPM})`,
                                severity: remaining <= 0 ? 'high' : 'medium',
                                remainingRPM: remaining
                            });
                        }
                    }
                }
            }

            return res.json({
                success: true,
                data: alerts,
                count: alerts.length
            });

        } catch (error) {
            console.error("Error fetching service alerts:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to fetch alerts"
            });
        }
    };

    // Helper to get machine maintenance status
    getMaintenanceStatus = async (req, res) => {
        try {
            const { type, id } = req.params; // type: machine/compressor
            let asset;

            if (type === 'machine') {
                asset = await Machine.findByPk(id, { attributes: ['id', 'machineNumber', 'machineRPM', 'maintenanceConfig'] });
            } else if (type === 'compressor') {
                asset = await Compressor.findByPk(id, { attributes: ['id', 'compressorName', 'compressorRPM', 'maintenanceConfig'] });
            }

            if (!asset) return res.status(404).json({ success: false, message: "Asset not found" });

            const currentRPM = (type === 'machine' ? asset.machineRPM : asset.compressorRPM) || 0;
            let config = asset.maintenanceConfig || [];
            if (typeof config === 'string') {
                try { config = JSON.parse(config); } catch (e) { config = []; }
            }
            // Ensure array
            if (!Array.isArray(config)) config = [];

            const statuses = [];

            if (Array.isArray(config)) {
                for (const item of config) {
                    const cycle = Number(item.cycle);
                    if (!cycle || isNaN(cycle)) continue;

                    const lastService = Number(item.lastServiceRPM) || 0;
                    const nextService = lastService + cycle;
                    const remaining = nextService - currentRPM;

                    statuses.push({
                        name: item.name,
                        cycle: cycle,
                        lastServiceRPM: lastService,
                        nextServiceRPM: nextService,
                        currentRPM: currentRPM,
                        remaining: remaining,
                        percentage: Math.min(100, Math.max(0, (remaining / item.cycle) * 100)), // Approximate health %
                        status: remaining <= 0 ? 'Overdue' : (remaining <= 50 ? 'Due Soon' : 'OK')
                    });
                }
            }

            return res.json({ success: true, data: statuses });

        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

export default new ServiceController();
