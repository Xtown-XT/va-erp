import Machine from "../machine/machine.model.js";
import Compressor from "../compressor/compressor.model.js";
import { Op } from "sequelize";

class AlertsController {

    // Get all active alerts
    getServiceAlerts = async (req, res, next) => {
        try {
            const alerts = [];

            // 1. Machine Alerts
            const machines = await Machine.findAll({
                where: { status: 'active' },
                attributes: ['id', 'machineNumber', 'machineType', 'machineRPM', 'maintenanceConfig']
            });

            machines.forEach(m => {
                const currentRPM = m.machineRPM || 0;
                let config = m.maintenanceConfig || [];
                if (typeof config === 'string') {
                    try { config = JSON.parse(config); } catch (e) { config = []; }
                }

                if (Array.isArray(config)) {
                    config.forEach(service => {
                        const cycle = Number(service.cycle);
                        if (!cycle) return;

                        const lastService = Number(service.lastServiceRPM) || 0;
                        const nextDue = lastService + cycle;
                        const remaining = nextDue - currentRPM;

                        if (remaining <= 50) {
                            alerts.push({
                                id: `M_${m.id}_${service.name}`,
                                entity: 'Machine',
                                name: m.machineNumber,
                                type: service.name,
                                currentRPM: currentRPM,
                                dueAt: nextDue,
                                remaining: remaining,
                                severity: remaining <= 0 ? 'critical' : 'warning'
                            });
                        }
                    });
                }
            });

            // 2. Compressor Alerts
            const compressors = await Compressor.findAll({
                where: { status: 'active' },
                attributes: ['id', 'compressorName', 'compressorRPM', 'maintenanceConfig']
            });

            compressors.forEach(c => {
                const currentRPM = c.compressorRPM || 0;
                let config = c.maintenanceConfig || [];
                if (typeof config === 'string') {
                    try { config = JSON.parse(config); } catch (e) { config = []; }
                }

                if (Array.isArray(config)) {
                    config.forEach(service => {
                        const cycle = Number(service.cycle);
                        if (!cycle) return;

                        const lastService = Number(service.lastServiceRPM) || 0;
                        const nextDue = lastService + cycle;
                        const remaining = nextDue - currentRPM;

                        if (remaining <= 50) {
                            alerts.push({
                                id: `C_${c.id}_${service.name}`,
                                entity: 'Compressor',
                                name: c.compressorName,
                                type: service.name,
                                currentRPM: currentRPM,
                                dueAt: nextDue,
                                remaining: remaining,
                                severity: remaining <= 0 ? 'critical' : 'warning'
                            });
                        }
                    });
                }
            });

            // Sort by remaining desc (lowest remaining first)
            alerts.sort((a, b) => a.remaining - b.remaining);

            return res.json({ success: true, count: alerts.length, data: alerts });

        } catch (error) {
            next(error);
        }
    }
}

export default new AlertsController();
