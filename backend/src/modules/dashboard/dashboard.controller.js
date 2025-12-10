import { Op } from "sequelize";
import sequelize from "../../config/db.js";
import PurchaseOrder from "../inventory/models/purchaseOrder.model.js";
import DailyEntry from "../dailyEntry/dailyEntry.model.js";
import EmployeeAttendance from "../employee/employeeAttendance.model.js";
import Site from "../site/site.model.js";
import Machine from "../machine/machine.model.js";
import EmployeeList from "../employee/employeeList.model.js";

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
                    // MySQL requires backticks for columns in literals if not using ANSI_QUOTES
                    [sequelize.literal('SUM(COALESCE(`machineHSD`, 0) + COALESCE(`compressorHSD`, 0) + COALESCE(`dieselUsed`, 0))'), 'totalDiesel']
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

            // 4. New Operational Stats (Sites, Machines, Workers)
            // These generally reflect CURRENT state, not filtered by date, unless we track history.
            // For now, we return current active counts.
            const totalSites = await Site.count({ where: { siteStatus: true } });
            const totalMachines = await Machine.count({ where: { status: 'active' } });
            const totalWorkers = await EmployeeList.count({ where: { status: 'active' } });

            // 5. Financials
            // Total Salary Paid (sum of salary in attendance for the period)
            const totalSalaryPaid = await EmployeeAttendance.sum('salary', {
                where: {
                    ...laborWhere,
                    presence: 'present'
                }
            });

            // Total Pending Advance (Current state from EmployeeList)
            const totalPendingAdvance = await EmployeeList.sum('advancedAmount', {
                where: { status: 'active' }
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
                        totalMeter: Math.round(parseFloat(productionStats[0]?.totalMeter || 0)),
                        totalHoles: parseFloat(productionStats[0]?.totalHoles || 0),
                        totalDiesel: parseFloat(productionStats[0]?.totalDiesel || 0)
                    },
                    labor: {
                        totalManDays: laborStats,
                        totalWorkers,
                        totalSalaryPaid: totalSalaryPaid || 0,
                        totalPendingAdvance: totalPendingAdvance || 0
                    },
                    operations: {
                        totalSites,
                        totalMachines
                    }
                }
            });

        } catch (error) {
            next(error);
        }
    }
};
