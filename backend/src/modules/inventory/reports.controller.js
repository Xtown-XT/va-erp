import ServiceItem from "../service/models/serviceItem.model.js";
import PurchaseOrder from "./models/purchaseOrder.model.js";
import PurchaseOrderItem from "./models/purchaseOrderItem.model.js";
import SiteStock from "./models/siteStock.model.js";
import Site from "../site/site.model.js";
import Spares from "../spares/spares.model.js";
import ServiceHistory from "../service/models/serviceHistory.model.js";
import Machine from "../machine/machine.model.js";
import Compressor from "../compressor/compressor.model.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.js";

class ReportsController {
    // Spares Summary Report: Consumption vs Purchase per Site
    sparesSummary = async (req, res) => {
        try {
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: "startDate and endDate are required",
                });
            }

            // Get all sites
            const sites = await Site.findAll({ attributes: ["id", "siteName"] });

            const report = [];

            for (const site of sites) {
                // Consumption: ServiceItems for this site within date range
                const consumption = await ServiceItem.findAll({
                    attributes: [
                        "spareId",
                        [sequelize.fn("SUM", sequelize.col("quantity")), "totalQty"],
                    ],
                    include: [
                        {
                            association: "serviceHistory",
                            attributes: [],
                            where: {
                                serviceDate: {
                                    [Op.between]: [startDate, endDate],
                                },
                            },
                            required: true,
                        },
                        {
                            model: Spares,
                            as: "spare",
                            attributes: ["name", "partNumber"],
                        },
                    ],
                    where: {
                        itemType: "spare",
                        spareId: { [Op.ne]: null },
                    },
                    group: ["spareId", "spare.id"],
                    raw: false,
                });

                // Purchases: PO items received to this site within date range
                const purchases = await sequelize.query(
                    `
          SELECT 
            poi.spareId,
            s.name,
            s.partNumber,
            SUM(CAST(JSON_EXTRACT(poi.distribution, CONCAT('$."', :siteId, '"')) AS UNSIGNED)) as totalQty
          FROM purchaseOrderItem poi
          JOIN purchaseOrder po ON poi.purchaseOrderId = po.id
          JOIN spares s ON poi.spareId = s.id
          WHERE po.status = 'Received'
            AND po.date BETWEEN :startDate AND :endDate
            AND poi.itemType = 'spare'
            AND JSON_EXTRACT(poi.distribution, CONCAT('$."', :siteId, '"')) IS NOT NULL
          GROUP BY poi.spareId, s.name, s.partNumber
        `,
                    {
                        replacements: { siteId: site.id, startDate, endDate },
                        type: sequelize.QueryTypes.SELECT,
                    }
                );

                // Combine data
                const spareMap = {};

                consumption.forEach((item) => {
                    const spareId = item.spareId;
                    if (!spareMap[spareId]) {
                        spareMap[spareId] = {
                            spareId,
                            spareName: item.spare?.name || "Unknown",
                            partNumber: item.spare?.partNumber || "-",
                            consumed: 0,
                            purchased: 0,
                        };
                    }
                    spareMap[spareId].consumed = parseInt(item.dataValues.totalQty) || 0;
                });

                purchases.forEach((item) => {
                    const spareId = item.spareId;
                    if (!spareMap[spareId]) {
                        spareMap[spareId] = {
                            spareId,
                            spareName: item.name || "Unknown",
                            partNumber: item.partNumber || "-",
                            consumed: 0,
                            purchased: 0,
                        };
                    }
                    spareMap[spareId].purchased = parseInt(item.totalQty) || 0;
                });

                const spares = Object.values(spareMap);

                if (spares.length > 0) {
                    report.push({
                        siteId: site.id,
                        siteName: site.siteName,
                        spares,
                    });
                }
            }

            return res.json({
                success: true,
                data: report,
                dateRange: { startDate, endDate },
            });
        } catch (error) {
            console.error("Error generating spares summary:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate report",
            });
        }
    };

    // Spares Usage Log: Detailed list of usage
    sparesUsageLog = async (req, res) => {
        try {
            const { startDate, endDate, siteId } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: "startDate and endDate are required",
                });
            }

            const whereClause = {
                serviceDate: { [Op.between]: [startDate, endDate] }
            };
            if (siteId) whereClause.siteId = siteId;

            // 1. Fetch Spares Usage (ServiceItem)
            const sparesUsage = await ServiceItem.findAll({
                attributes: ["id", "quantity", "spareId", "itemType"],
                include: [
                    {
                        model: ServiceHistory,
                        as: "serviceHistory",
                        attributes: ["serviceDate", "serviceType", "siteId", "machineId", "compressorId"],
                        where: whereClause,
                        required: true,
                        include: [
                            { model: Site, as: "site", attributes: ["siteName"] },
                            { model: Machine, as: "machine", attributes: ["machineNumber", "machineType"] },
                            { model: Compressor, as: "compressor", attributes: ["compressorName"] }
                        ]
                    },
                    {
                        model: Spares,
                        as: "spare",
                        attributes: ["name", "partNumber"]
                    }
                ],
                where: {
                    itemType: "spare",
                    spareId: { [Op.ne]: null }
                },
                order: [[{ model: ServiceHistory, as: "serviceHistory" }, "serviceDate", "DESC"]]
            });

            const sparesData = sparesUsage.map(u => ({
                id: u.id,
                fittedDate: u.serviceHistory?.serviceDate, // Map serviceDate to fittedDate for uniform sorting
                siteName: u.serviceHistory?.site?.siteName,
                item: {
                    itemName: u.spare?.name,
                    partNumber: u.spare?.partNumber,
                },
                quantity: u.quantity,
                serviceType: u.serviceHistory?.serviceType || 'spare',
                machine: u.serviceHistory?.machine,
                compressor: u.serviceHistory?.compressor,
                machineId: u.serviceHistory?.machineId,
                compressorId: u.serviceHistory?.compressorId,
                status: 'consumed' // Spares are consumed immediately
            }));

            // Return strictly spares data
            const data = sparesData.sort((a, b) => new Date(b.fittedDate) - new Date(a.fittedDate));

            return res.json({
                success: true,
                data: data,
                dateRange: { startDate, endDate },
            });
        } catch (error) {
            console.error("Error generating spares usage log:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate report",
            });
        }
    };

    // Production Report: Site-wise aggregation
    productionSitewise = async (req, res) => {
        try {
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: "startDate and endDate are required",
                });
            }

            // Query to aggregate by site
            const results = await sequelize.query(`
                SELECT 
                    s.id as siteId,
                    s.siteName,
                    SUM(de.meter) as totalMeter,
                    SUM(CASE 
                        WHEN LOWER(m.machineType) LIKE '%crawler%' THEN de.machineHSD 
                        ELSE 0 
                    END) as totalCrawlerHSD,
                    SUM(de.compressorHSD) as totalCompHSD,
                    SUM(CASE 
                        WHEN LOWER(m.machineType) LIKE '%camper%' OR LOWER(m.machineType) LIKE '%truck%' THEN de.machineHSD 
                        ELSE 0 
                    END) as totalCamperHSD,
                    SUM(de.machineHSD + COALESCE(de.compressorHSD, 0)) as totalTotalHSD,
                    SUM(CASE 
                        WHEN LOWER(m.machineType) LIKE '%crawler%' THEN (de.machineClosingRPM - de.machineOpeningRPM) 
                        ELSE 0 
                    END) as totalCrawlerRPM,
                    SUM(de.compressorClosingRPM - de.compressorOpeningRPM) as totalCompRPM,
                    SUM(de.noOfHoles) as totalHoles,
                    COUNT(de.id) as entryCount
                FROM dailyEntry de
                JOIN site s ON de.siteId = s.id
                JOIN machine m ON de.machineId = m.id
                WHERE de.date BETWEEN :startDate AND :endDate
                GROUP BY s.id, s.siteName
                ORDER BY s.siteName
            `, {
                replacements: { startDate, endDate },
                type: sequelize.QueryTypes.SELECT,
            });

            // Calculate ratios and depth average
            const processedResults = results.map(row => {
                const totalMeter = parseFloat(row.totalMeter) || 0;
                const totalHoles = parseInt(row.totalHoles) || 0;
                const totalCrawlerHSD = parseFloat(row.totalCrawlerHSD) || 0;
                const totalCompHSD = parseFloat(row.totalCompHSD) || 0;
                const totalCamperHSD = parseFloat(row.totalCamperHSD) || 0;
                const totalTotalHSD = parseFloat(row.totalTotalHSD) || 0;
                const totalCrawlerRPM = parseFloat(row.totalCrawlerRPM) || 0;
                const totalCompRPM = parseFloat(row.totalCompRPM) || 0;

                return {
                    siteId: row.siteId,
                    siteName: row.siteName,
                    totalMeter,
                    totalCrawlerHSD,
                    totalCompHSD,
                    totalCamperHSD,
                    totalTotalHSD,
                    totalCrawlerRPM,
                    totalCompRPM,
                    totalHoles,
                    avgDepth: totalHoles > 0 ? (totalMeter / totalHoles) : 0,
                    hsdPerMeter: totalMeter > 0 ? (totalTotalHSD / totalMeter) : 0,
                    meterPerRPM: totalCompRPM > 0 ? (totalMeter / totalCompRPM) : 0,
                    crawlerHSDPerRPM: totalCrawlerRPM > 0 ? (totalCrawlerHSD / totalCrawlerRPM) : 0,
                    compHSDPerRPM: totalCompRPM > 0 ? (totalCompHSD / totalCompRPM) : 0,
                };
            });

            return res.json({
                success: true,
                data: processedResults,
                dateRange: { startDate, endDate },
            });
        } catch (error) {
            console.error("Error generating sitewise production report:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate report",
            });
        }
    };

    // Production Report: Machine-wise aggregation
    productionMachinewise = async (req, res) => {
        try {
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: "startDate and endDate are required",
                });
            }

            // Query to aggregate by machine
            const results = await sequelize.query(`
                SELECT 
                    m.id as machineId,
                    m.machineNumber,
                    m.machineType,
                    SUM(de.meter) as totalMeter,
                    SUM(CASE 
                        WHEN LOWER(m.machineType) LIKE '%crawler%' THEN de.machineHSD 
                        ELSE 0 
                    END) as totalCrawlerHSD,
                    SUM(de.compressorHSD) as totalCompHSD,
                    SUM(CASE 
                        WHEN LOWER(m.machineType) LIKE '%camper%' OR LOWER(m.machineType) LIKE '%truck%' THEN de.machineHSD 
                        ELSE 0 
                    END) as totalCamperHSD,
                    SUM(de.machineHSD + COALESCE(de.compressorHSD, 0)) as totalTotalHSD,
                    SUM(CASE 
                        WHEN LOWER(m.machineType) LIKE '%crawler%' THEN (de.machineClosingRPM - de.machineOpeningRPM) 
                        ELSE 0 
                    END) as totalCrawlerRPM,
                    SUM(de.compressorClosingRPM - de.compressorOpeningRPM) as totalCompRPM,
                    SUM(de.noOfHoles) as totalHoles,
                    COUNT(de.id) as entryCount
                FROM dailyEntry de
                JOIN machine m ON de.machineId = m.id
                WHERE de.date BETWEEN :startDate AND :endDate
                GROUP BY m.id, m.machineNumber, m.machineType
                ORDER BY m.machineNumber
            `, {
                replacements: { startDate, endDate },
                type: sequelize.QueryTypes.SELECT,
            });

            // Calculate ratios and depth average
            const processedResults = results.map(row => {
                const totalMeter = parseFloat(row.totalMeter) || 0;
                const totalHoles = parseInt(row.totalHoles) || 0;
                const totalCrawlerHSD = parseFloat(row.totalCrawlerHSD) || 0;
                const totalCompHSD = parseFloat(row.totalCompHSD) || 0;
                const totalCamperHSD = parseFloat(row.totalCamperHSD) || 0;
                const totalTotalHSD = parseFloat(row.totalTotalHSD) || 0;
                const totalCrawlerRPM = parseFloat(row.totalCrawlerRPM) || 0;
                const totalCompRPM = parseFloat(row.totalCompRPM) || 0;

                return {
                    machineId: row.machineId,
                    machineNumber: row.machineNumber,
                    machineType: row.machineType,
                    totalMeter,
                    totalCrawlerHSD,
                    totalCompHSD,
                    totalCamperHSD,
                    totalTotalHSD,
                    totalCrawlerRPM,
                    totalCompRPM,
                    totalHoles,
                    avgDepth: totalHoles > 0 ? (totalMeter / totalHoles) : 0,
                    hsdPerMeter: totalMeter > 0 ? (totalTotalHSD / totalMeter) : 0,
                    meterPerRPM: totalCompRPM > 0 ? (totalMeter / totalCompRPM) : 0,
                    crawlerHSDPerRPM: totalCrawlerRPM > 0 ? (totalCrawlerHSD / totalCrawlerRPM) : 0,
                    compHSDPerRPM: totalCompRPM > 0 ? (totalCompHSD / totalCompRPM) : 0,
                };
            });

            return res.json({
                success: true,
                data: processedResults,
                dateRange: { startDate, endDate },
            });
        } catch (error) {
            console.error("Error generating machinewise production report:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate report",
            });
        }
    };
    // Production Report: Day-wise breakdown for a specific site
    productionDaywise = async (req, res) => {
        try {
            const { startDate, endDate, siteId, machineId } = req.query; // Added machineId

            if (!startDate || !endDate || !siteId) {
                return res.status(400).json({
                    success: false,
                    message: "startDate, endDate, and siteId are required",
                });
            }

            let machineFilter = "";
            const replacements = { startDate, endDate, siteId };

            if (machineId) {
                machineFilter = "AND de.machineId = :machineId";
                replacements.machineId = machineId;
            }

            const results = await sequelize.query(`
                SELECT 
                    de.date,
                    SUM(de.meter) as totalMeter,
                    SUM(CASE 
                        WHEN LOWER(m.machineType) LIKE '%crawler%' THEN de.machineHSD 
                        ELSE 0 
                    END) as totalCrawlerHSD,
                    SUM(de.compressorHSD) as totalCompHSD,
                    SUM(CASE 
                        WHEN LOWER(m.machineType) LIKE '%camper%' OR LOWER(m.machineType) LIKE '%truck%' THEN de.machineHSD 
                        ELSE 0 
                    END) as totalCamperHSD,
                    SUM(de.machineHSD + COALESCE(de.compressorHSD, 0)) as totalTotalHSD,
                    SUM(CASE 
                        WHEN LOWER(m.machineType) LIKE '%crawler%' THEN (de.machineClosingRPM - de.machineOpeningRPM) 
                        ELSE 0 
                    END) as totalCrawlerRPM,
                    SUM(de.compressorClosingRPM - de.compressorOpeningRPM) as totalCompRPM,
                    SUM(de.noOfHoles) as totalHoles,
                    COUNT(de.id) as entryCount
                FROM dailyEntry de
                JOIN machine m ON de.machineId = m.id
                WHERE de.siteId = :siteId 
                  AND de.date BETWEEN :startDate AND :endDate
                  ${machineFilter}
                GROUP BY de.date
                ORDER BY de.date
            `, {
                replacements: replacements,
                type: sequelize.QueryTypes.SELECT,
            });

            // Calculate ratios
            const processedResults = results.map(row => {
                const totalMeter = parseFloat(row.totalMeter) || 0;
                const totalHoles = parseInt(row.totalHoles) || 0;
                const totalCrawlerHSD = parseFloat(row.totalCrawlerHSD) || 0;
                const totalCompHSD = parseFloat(row.totalCompHSD) || 0;
                // const totalCamperHSD = parseFloat(row.totalCamperHSD) || 0; 
                const totalTotalHSD = parseFloat(row.totalTotalHSD) || 0;
                const totalCrawlerRPM = parseFloat(row.totalCrawlerRPM) || 0;
                const totalCompRPM = parseFloat(row.totalCompRPM) || 0;

                return {
                    date: row.date,
                    totalMeter,
                    totalCrawlerHSD,
                    totalCompHSD,
                    totalCamperHSD: parseFloat(row.totalCamperHSD) || 0,
                    totalTotalHSD,
                    totalCrawlerRPM,
                    totalCompRPM,
                    totalHoles,
                    avgDepth: totalHoles > 0 ? (totalMeter / totalHoles) : 0,
                    hsdPerMeter: totalMeter > 0 ? (totalTotalHSD / totalMeter) : 0,
                    meterPerRPM: totalCompRPM > 0 ? (totalMeter / totalCompRPM) : 0,
                    crawlerHSDPerRPM: totalCrawlerRPM > 0 ? (totalCrawlerHSD / totalCrawlerRPM) : 0,
                    compHSDPerRPM: totalCompRPM > 0 ? (totalCompHSD / totalCompRPM) : 0,
                };
            });

            return res.json({
                success: true,
                data: processedResults,
                // Meta info for frontend title/headers
                dateRange: { startDate, endDate },
            });

        } catch (error) {
            console.error("Error generating daywise production report:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate report",
            });
        }
    };

    // Service Summary Report: Sitewise aggregation of services
    serviceSummarySitewise = async (req, res) => {
        try {
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: "startDate and endDate are required",
                });
            }

            const results = await sequelize.query(`
                SELECT 
                    s.id as siteId,
                    s.siteName,
                    sh.serviceName,
                    COUNT(sh.id) as serviceCount
                FROM service_history sh
                JOIN site s ON sh.siteId = s.id
                WHERE sh.serviceDate BETWEEN :startDate AND :endDate
                GROUP BY s.id, s.siteName, sh.serviceName
                ORDER BY s.siteName, sh.serviceName
            `, {
                replacements: { startDate, endDate },
                type: sequelize.QueryTypes.SELECT,
            });

            // Group by Site
            const report = [];
            const siteMap = {};

            results.forEach(row => {
                if (!siteMap[row.siteId]) {
                    siteMap[row.siteId] = {
                        siteId: row.siteId,
                        siteName: row.siteName,
                        services: []
                    };
                    report.push(siteMap[row.siteId]);
                }
                siteMap[row.siteId].services.push({
                    serviceName: row.serviceName,
                    count: parseInt(row.serviceCount) || 0
                });
            });

            return res.json({
                success: true,
                data: report,
                dateRange: { startDate, endDate },
            });

        } catch (error) {
            console.error("Error generating service summary report:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate report",
            });
        }
    };
}

export default new ReportsController();
