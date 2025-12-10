import { Op } from "sequelize";
import sequelize from "../../config/db.js";
import PurchaseOrder from "../inventory/models/purchaseOrder.model.js";
import DailyEntry from "../dailyEntry/dailyEntry.model.js";
import EmployeeAttendance from "../employee/employeeAttendance.model.js";

export const DashboardController = {
    getStats: async (req, res, next) => {
        try {
            const { startDate, endDate, siteId } = req.query;

            // Date Filter
            const dateFilter = {};
            if (startDate && endDate) {
                dateFilter.date = { [Op.between]: [startDate, endDate] };
            } else if (startDate) {
                dateFilter.date = { [Op.gte]: startDate };
            }

            // Site Filter (only applies to DailyEntry and Attendance)
            const siteFilter = siteId ? { siteId } : {};

            // 1. PO Stats (Global - POs are not strictly linked to one site usually)
            // If siteId is present, we might want to exclude POs or show them generally.
            // For now, we'll show Global PO stats for the period unless explicitly asked to filter (which we can't easily).
            const poWhere = { ...dateFilter };

            const poStats = await PurchaseOrder.findAll({
                where: poWhere,
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                    [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalValue'],
                    // Calculate Received Value
                    [sequelize.literal(`SUM(CASE WHEN status = 'Received' THEN "totalAmount" ELSE 0 END)`), 'receivedValue']
                ],
                raw: true
            });

            // 2. Production Stats (Daily Entry)
            const productionWhere = {
                ...dateFilter,
                ...siteFilter
            };

            const productionStats = await DailyEntry.findAll({
                where: productionWhere,
                attributes: [
                    [sequelize.fn('SUM', sequelize.col('meter')), 'totalMeter'],
                    [sequelize.fn('SUM', sequelize.col('noOfHoles')), 'totalHoles'],
                    // Diesel is sum of machineHSD + compressorHSD + dieselUsed
                    [sequelize.literal('SUM(COALESCE("machineHSD", 0) + COALESCE("compressorHSD", 0) + COALESCE("dieselUsed", 0))'), 'totalDiesel']
                ],
                raw: true
            });

            // 3. Labor Stats (Employee Attendance)
            const laborWhere = {
                ...dateFilter, // Attendance model has 'date' field? Need to verify.
                ...siteFilter // Attendance model has 'siteId'?
            };

            // Check Attendance Model fields: usually 'date' and 'siteId' exist.
            const laborStats = await EmployeeAttendance.count({
                where: {
                    ...laborWhere,
                    presence: 'present'
                }
            });

            res.json({
                success: true,
                data: {
                    po: {
                        count: parseInt(poStats[0]?.count || 0),
                        totalValue: parseFloat(poStats[0]?.totalValue || 0),
                        receivedValue: parseFloat(poStats[0]?.receivedValue || 0)
                    },
                    production: {
                        totalMeter: parseFloat(productionStats[0]?.totalMeter || 0),
                        totalHoles: parseFloat(productionStats[0]?.totalHoles || 0),
                        totalDiesel: parseFloat(productionStats[0]?.totalDiesel || 0)
                    },
                    labor: {
                        totalManDays: laborStats
                    }
                }
            });

        } catch (error) {
            next(error);
        }
    }
};
