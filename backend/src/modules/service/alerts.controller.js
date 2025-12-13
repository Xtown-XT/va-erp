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
                attributes: ['id', 'machineNumber', 'machineType', 'machineRPM', 'lastServiceRPM', 'serviceCycleRpm', 'lastEngineServiceRPM', 'engineServiceCycleRpm']
            });

            machines.forEach(m => {
                const current = m.machineRPM || 0;

                // General Service Alert
                const lastGen = m.lastServiceRPM || 0;
                const cycleGen = m.serviceCycleRpm || 250;
                const nextGen = lastGen + cycleGen;

                if (nextGen - current <= 20) {
                    alerts.push({
                        id: `M_GEN_${m.id}`,
                        entity: 'Machine',
                        name: m.machineNumber,
                        type: 'General Service',
                        currentRPM: current,
                        dueAt: nextGen,
                        remaining: nextGen - current,
                        severity: nextGen - current <= 0 ? 'critical' : 'warning'
                    });
                }

                // Engine Service Alert
                const lastEng = m.lastEngineServiceRPM || 0;
                // If engine cycle is distinct? Assuming yes.
                const cycleEng = m.engineServiceCycleRpm || 250;
                const nextEng = lastEng + cycleEng;

                if (nextEng - current <= 20) {
                    alerts.push({
                        id: `M_ENG_${m.id}`,
                        entity: 'Machine',
                        name: m.machineNumber,
                        type: 'Engine Service',
                        currentRPM: current,
                        dueAt: nextEng,
                        remaining: nextEng - current,
                        severity: nextEng - current <= 0 ? 'critical' : 'warning'
                    });
                }
            });

            // 2. Compressor Alerts
            const compressors = await Compressor.findAll({
                where: { status: 'active' },
                attributes: ['id', 'compressorName', 'compressorRPM', 'lastServiceRPM', 'serviceCycleRpm', 'lastEngineServiceRPM', 'engineServiceCycleRpm']
            });

            compressors.forEach(c => {
                const current = c.compressorRPM || 0;

                // General Service
                const lastGen = c.lastServiceRPM || 0;
                const cycleGen = c.serviceCycleRpm || 250;
                const nextGen = lastGen + cycleGen;

                if (nextGen - current <= 20) {
                    alerts.push({
                        id: `C_GEN_${c.id}`,
                        entity: 'Compressor',
                        name: c.compressorName,
                        type: 'General Service',
                        currentRPM: current,
                        dueAt: nextGen,
                        remaining: nextGen - current,
                        severity: nextGen - current <= 0 ? 'critical' : 'warning'
                    });
                }

                // Engine Service
                const lastEng = c.lastEngineServiceRPM || 0;
                const cycleEng = c.engineServiceCycleRpm || 300;
                const nextEng = lastEng + cycleEng;

                if (nextEng - current <= 20) {
                    alerts.push({
                        id: `C_ENG_${c.id}`,
                        entity: 'Compressor',
                        name: c.compressorName,
                        type: 'Engine Service',
                        currentRPM: current,
                        dueAt: nextEng,
                        remaining: nextEng - current,
                        severity: nextEng - current <= 0 ? 'critical' : 'warning'
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
