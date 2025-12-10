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
                serviceName,
                serviceType,
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
                serviceType,
                remarks,
                serviceType,
                remarks,
                currentRpm,
                siteId: siteId || null
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
                            throw new Error(`Insufficient stock for spare: ${item.itemId}`);
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

                            // Check copyRpm logic
                            const catalog = await DrillingTools.findByPk(toolInstance.drillingToolId);
                            // Logic for RPM inheritance would likely be calculated at runtime or daily entry, but here we just link it.
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

            // Update Last Service Info on Asset? (Optional, good for quick checks)
            // Update Last Service Info and Next Service RPM (Fixed Interval Logic)
            if (machineId && currentRpm) {
                const machine = await Machine.findByPk(machineId, { transaction: t });
                if (machine && machine.serviceCycleRpm) {
                    const cycle = machine.serviceCycleRpm;
                    const nextRPM = Math.ceil((currentRpm + 1) / cycle) * cycle;
                    await machine.update({ nextServiceRPM: nextRPM }, { transaction: t });
                }
            }
            if (compressorId && currentRpm) {
                const compressor = await Compressor.findByPk(compressorId, { transaction: t });
                if (compressor) {
                    if (serviceType === 'Compressor Service' && compressor.serviceCycleRpm) {
                        const cycle = compressor.serviceCycleRpm;
                        const nextRPM = Math.ceil((currentRpm + 1) / cycle) * cycle;
                        await compressor.update({ nextServiceRPM: nextRPM }, { transaction: t });
                    } else if (serviceType === 'Engine Service' && compressor.engineServiceCycleRpm) {
                        const cycle = compressor.engineServiceCycleRpm;
                        const nextRPM = Math.ceil((currentRpm + 1) / cycle) * cycle;
                        await compressor.update({ nextEngineServiceRPM: nextRPM }, { transaction: t });
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

    getNotifications = async (req, res) => {
        try {
            const notifications = [];

            // Check Machines
            const machines = await Machine.findAll({
                where: { status: 'active' },
                attributes: ['id', 'machineNumber', 'machineRPM', 'serviceCycleRpm', 'nextServiceRPM']
            });

            for (const machine of machines) {
                if (machine.nextServiceRPM && (machine.machineRPM >= machine.nextServiceRPM)) {
                    notifications.push({
                        type: 'Machine',
                        id: machine.id,
                        name: machine.machineNumber,
                        message: `Service Due! Current RPM: ${machine.machineRPM}, Next Service: ${machine.nextServiceRPM}`,
                        severity: 'high'
                    });
                }
            }

            // Check Compressors
            const compressors = await Compressor.findAll({
                where: { status: 'active' },
                attributes: ['id', 'compressorName', 'compressorRPM', 'serviceCycleRpm', 'engineServiceCycleRpm', 'nextServiceRPM']
            });

            for (const comp of compressors) {
                if (comp.nextServiceRPM && (comp.compressorRPM >= comp.nextServiceRPM)) {
                    notifications.push({
                        type: 'Compressor',
                        id: comp.id,
                        name: comp.compressorName,
                        message: `Service Due! Current RPM: ${comp.compressorRPM}, Next Service: ${comp.nextServiceRPM}`,
                        severity: 'high'
                    });
                }
            }

            return res.json({ success: true, message: "Fetched Notifications", data: notifications });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    };

    // Get Service Alerts based on cycle RPM
    getServiceAlerts = async (req, res) => {
        try {
            const alerts = [];

            // Check Machines
            const machines = await Machine.findAll({
                attributes: ['id', 'machineNumber', 'machineRPM', 'serviceCycleRpm'],
                where: { status: 'active' }
            });

            for (const machine of machines) {
                const currentRPM = machine.machineRPM || 0;
                // Service Alert: Trigger if Next Service exists AND current RPM is within 50 of target (or passed it)
                if (machine.nextServiceRPM && (currentRPM >= machine.nextServiceRPM - 50)) {
                    alerts.push({
                        type: 'machine',
                        assetId: machine.id,
                        name: machine.machineNumber,
                        message: `Machine service due at ${machine.nextServiceRPM} RPM (Current: ${currentRPM})`,
                        severity: currentRPM >= machine.nextServiceRPM ? 'high' : 'medium'
                    });
                }
            }

            // Check Compressors
            const compressors = await Compressor.findAll({
                attributes: ['id', 'compressorName', 'compressorRPM', 'serviceCycleRpm', 'engineServiceCycleRpm'],
                where: { status: 'active' }
            });

            for (const compressor of compressors) {
                const currentRPM = compressor.compressorRPM || 0;

                // Compressor Service Alert
                if (compressor.nextServiceRPM && (currentRPM >= compressor.nextServiceRPM - 50)) {
                    alerts.push({
                        type: 'compressor',
                        assetId: compressor.id,
                        name: compressor.compressorName,
                        message: `Compressor service due at ${compressor.nextServiceRPM} RPM (Current: ${currentRPM})`,
                        severity: currentRPM >= compressor.nextServiceRPM ? 'high' : 'medium'
                    });
                }

                // Engine Service Alert
                if (compressor.nextEngineServiceRPM && (currentRPM >= compressor.nextEngineServiceRPM - 50)) {
                    alerts.push({
                        type: 'compressor_engine',
                        assetId: compressor.id,
                        name: compressor.compressorName,
                        message: `Compressor engine service due at ${compressor.nextEngineServiceRPM} RPM (Current: ${currentRPM})`,
                        severity: currentRPM >= compressor.nextEngineServiceRPM ? 'high' : 'medium'
                    });
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
}

export default new ServiceController();
