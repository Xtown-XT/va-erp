import { Op } from "sequelize";
import sequelize from "../../config/db.js";
import PurchaseOrder from "../inventory/models/purchaseOrder.model.js";
import DailyEntry from "../dailyEntry/dailyEntry.model.js";
import EmployeeAttendance from "../employee/employeeAttendance.model.js";
import Site from "../site/site.model.js";
import Machine from "../machine/machine.model.js";
import EmployeeList from "../employee/employeeList.model.js";
import Compressor from "../compressor/compressor.model.js";
import Supplier from "../supplier/supplier.model.js";

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
                    [sequelize.literal('SUM(COALESCE(`machineHSD`, 0) + COALESCE(`compressorHSD`, 0) + COALESCE(`dieselUsed`, 0))'), 'totalDiesel']
                ],
                raw: true
            });

            // 3. Labor Stats (Employee Attendance)
            const laborWhere = {
                ...dateFilter,
                ...siteFilter
            };

            const laborStats = await EmployeeAttendance.count({
                where: {
                    ...laborWhere,
                    presence: 'present'
                }
            });

            // 4. Counts (Static / Current State)
            const totalSites = await Site.count({ where: { siteStatus: true } });
            const totalMachines = await Machine.count({ where: { status: 'active' } });
            const totalWorkers = await EmployeeList.count({ where: { status: 'active' } });
            const totalCompressors = await Compressor.count({ where: { status: 'active' } });
            const totalSuppliers = await Supplier.count({ where: { status: 'active' } });

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
                    // Counts Section
                    counts: {
                        employees: totalWorkers,
                        machines: totalMachines,
                        sites: totalSites,
                        compressors: totalCompressors,
                        suppliers: totalSuppliers,
                        employeeAdvance: parseFloat(totalPendingAdvance || 0)
                    },
                    // Filtered Metrics
                    metrics: {
                        poCreated: parseFloat(poStats[0]?.totalValue || 0),
                        poReceived: parseFloat(poStats[0]?.receivedValue || 0),
                        salariesPaid: parseFloat(totalSalaryPaid || 0),
                        productionMeter: Math.round(parseFloat(productionStats[0]?.totalMeter || 0)),
                        holesDrilled: parseFloat(productionStats[0]?.totalHoles || 0),
                        dieselConsumed: parseFloat(productionStats[0]?.totalDiesel || 0),
                        manDays: laborStats
                    },
                    // Overview Chart: Daily Meter for the date range
                    overview: await DailyEntry.findAll({
                        where: productionWhere,
                        attributes: [
                            'date',
                            [sequelize.fn('SUM', sequelize.col('meter')), 'totalMeter']
                        ],
                        group: ['date'],
                        order: [['date', 'ASC']],
                        raw: true
                    }),
                    // Recent Activity: Last 5 Entries
                    recentActivity: await DailyEntry.findAll({
                        where: productionWhere,
                        limit: 5,
                        order: [['date', 'DESC'], ['createdAt', 'DESC']],
                        include: [
                            { model: Site, as: 'site', attributes: ['siteName'] },
                            { model: Machine, as: 'machine', attributes: ['machineNumber'] }
                        ],
                        attributes: ['id', 'date', 'meter', 'noOfHoles']
                    })
                }
            });

        } catch (error) {
            next(error);
        }
    }
};
