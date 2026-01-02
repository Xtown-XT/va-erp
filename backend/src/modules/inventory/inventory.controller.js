import Purchase from "./models/purchase.model.js";
import PurchaseOrderItem from "./models/purchaseOrderItem.model.js";
import ServiceItem from "../service/models/serviceItem.model.js";
import SiteStock from "./models/siteStock.model.js";
import Spares from "../spares/spares.model.js";
import DrillingTools from "../drillingTools/drillingTools.model.js";
import DrillingToolItems from "../drillingTools/drillingToolItems.model.js";
import Site from "../site/site.model.js";
import Supplier from "../supplier/supplier.model.js";
import sequelize from "../../config/db.js";
import { Op } from "sequelize";

export const InventoryController = {
    // === Purchase Logic ===
    createPurchase: async (req, res, next) => {
        const t = await sequelize.transaction();
        try {
            const {
                date, spareId, drillingToolId, supplierId, quantity, unitPrice
            } = req.body;
            let { totalPrice } = req.body;

            if (!totalPrice) {
                totalPrice = quantity * unitPrice;
            }

            const purchase = await Purchase.create({
                date: date || new Date(),
                spareId,
                drillingToolId,
                supplierId,
                quantity,
                unitPrice,
                totalPrice,
                createdBy: req.user ? req.user.username : 'system',
            }, { transaction: t });

            await t.commit();
            res.json({ success: true, data: purchase });
        } catch (error) {
            await t.rollback();
            next(error);
        }
    },

    getAllPurchases: async (req, res, next) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const { count, rows } = await Purchase.findAndCountAll({
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['date', 'DESC']],
                include: [
                    { model: Spares, as: 'spare' },
                    { model: DrillingTools, as: 'drillingTool' },
                    { model: Supplier, as: 'supplier' }
                ]
            });

            res.json({ success: true, total: count, limit: parseInt(limit), page: parseInt(page), data: rows });
        } catch (error) {
            next(error);
        }
    },

    // === Stock Logic ===
    getSiteStock: async (req, res, next) => {
        try {
            const { siteId } = req.query;
            const where = {};
            if (siteId) where.siteId = siteId;

            const stocks = await SiteStock.findAll({
                where,
                include: [
                    { model: Site, as: 'site' },
                    { model: Spares, as: 'spare' },
                    { model: DrillingTools, as: 'drillingTool' }
                ]
            });

            res.json({ success: true, data: stocks });
        } catch (error) {
            next(error);
        }
    },

    getSiteWiseStock: async (req, res, next) => {
        try {
            const sites = await Site.findAll({
                where: { siteStatus: true }
            });

            const siteStockData = await Promise.all(sites.map(async (site) => {
                const stocks = await SiteStock.findAll({
                    where: { siteId: site.id },
                    include: [
                        { model: Spares, as: 'spare' },
                        { model: DrillingTools, as: 'drillingTool' }
                    ]
                });

                const spares = stocks.filter(s => s.spareId).map(s => ({
                    id: s.id,
                    spareId: s.spareId,
                    name: s.spare?.name,
                    quantity: s.quantity,
                    partNumber: s.spare?.partNumber,
                    type: s.spare?.spareType
                }));

                const tools = stocks.filter(s => s.drillingToolId).map(s => ({
                    id: s.id,
                    toolId: s.drillingToolId,
                    name: s.drillingTool?.name,
                    quantity: s.quantity,
                    partNumber: s.drillingTool?.partNumber,
                    totalRPM: s.drillingTool?.totalRPM,
                    totalMeters: s.drillingTool?.totalMeters,
                    price: s.drillingTool?.price,
                    rpmSource: s.drillingTool?.rpmSource
                }));

                return {
                    siteId: site.id,
                    siteName: site.siteName,
                    sparesCount: spares.reduce((sum, s) => sum + s.quantity, 0),
                    toolsCount: tools.reduce((sum, t) => sum + t.quantity, 0),
                    spares,
                    tools
                };
            }));

            const totals = {
                totalSpares: siteStockData.reduce((sum, site) => sum + site.sparesCount, 0),
                totalTools: siteStockData.reduce((sum, site) => sum + site.toolsCount, 0)
            };

            res.json({ success: true, data: { sites: siteStockData, totals } });
        } catch (error) {
            next(error);
        }
    },

    updateStock: async (req, res, next) => {
        const t = await sequelize.transaction();
        try {
            const { siteId, spareId, drillingToolId, quantity, mode = 'add', serialNumber, initialRPM, initialMeter } = req.body;




            // Update Aggregate SiteStock (common for both Spares and Tools for summary)
            let stock = await SiteStock.findOne({
                where: {
                    siteId,
                    ...(spareId ? { spareId } : {}),
                    ...(drillingToolId ? { drillingToolId } : {})
                },
                transaction: t
            });

            const qtyChange = Number(quantity);

            if (!stock) {
                if (mode === 'add' && qtyChange < 0) {
                    await t.rollback();
                    return res.status(400).json({ success: false, message: "Cannot reduce stock from 0" });
                }
                stock = await SiteStock.create({
                    siteId,
                    spareId,
                    drillingToolId,
                    quantity: mode === 'set' ? qtyChange : qtyChange,
                    createdBy: req.user ? req.user.username : 'system'
                }, { transaction: t });
            } else {
                const newQty = mode === 'set' ? qtyChange : (stock.quantity + qtyChange);
                if (newQty < 0) {
                    await t.rollback();
                    return res.status(400).json({ success: false, message: "Insufficient stock" });
                }

                stock.quantity = newQty;
                stock.updatedBy = req.user ? req.user.username : 'system';
                await stock.save({ transaction: t });
            }

            await t.commit();
            res.json({ success: true, data: stock });
        } catch (error) {
            await t.rollback();
            next(error);
        }
    },

    getStockReport: async (req, res, next) => {
        try {
            const { startDate, endDate, itemType, siteId } = req.query;
            const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
            // End of the day for endDate
            const end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date();
            const now = new Date();

            // 1. Get Base Items (Spares and DrillingTools)
            // We fetch ALL items to list them even if stock is 0? Yes.
            let items = [];
            if (!itemType || itemType === 'spares' || itemType === 'all' || itemType === '') {
                const spares = await Spares.findAll({ lean: true, raw: true });
                items = [...items, ...spares.map(s => ({ ...s, itemType: 'Spare' }))];
            }
            if (!itemType || itemType === 'Drilling Tools' || itemType === 'all' || itemType === '') {
                const tools = await DrillingTools.findAll({ lean: true, raw: true });
                items = [...items, ...tools.map(t => ({ ...t, itemType: 'Drilling Tool', groupName: t.type }))];
            }

            // 2. Get Current Stock (from SiteStock)
            // If siteId provided, filter. Else sum all.
            const stockWhere = {};
            if (siteId) stockWhere.siteId = siteId;
            const currentStocks = await SiteStock.findAll({ where: stockWhere, raw: true });

            // Helper to get current qty for an item
            const getCurrentQty = (itemId, type) => {
                const relevantStocks = currentStocks.filter(s =>
                    type === 'Spare' ? s.spareId === itemId : s.drillingToolId === itemId
                );
                return relevantStocks.reduce((sum, s) => sum + (s.quantity || 0), 0);
            };

            // 3. Fetch Transactions (Inward & Outward) from Start Date to NOW
            // We need transactions from Start to Now to:
            // - Calculate Added/Used in Period (Start to End)
            // - Reverse calc Opening from Current (Current - Added(Start-Now) + Used(Start-Now) ??? No)

            // Correct Reverse Logic:
            // Closing (at End Date) = Current Stock - Inward(End+ to Now) + Outward(End+ to Now)
            // Opening (at Start Date) = Closing - Inward(Start to End) + Outward(Start to End)

            // So we need transactions from Start -> Now? 
            // Actually we need transactions from (End Date onwards) to calculate Closing from Current.
            // AND we need transactions from (Start to End) to calculate Opening from Closing.
            // So essentially we need transactions from Start to Now? 
            // Wait, if we only fetch Start->Now, we can't reverse calc Opening if we don't know Closing?
            // Closing is derived from Current.

            // Transactions needed:
            // - Inward/Outward AFTER End Date (to rollback Current -> Closing)
            // - Inward/Outward BETWEEN Start and End (for Report Columns and rollback Closing -> Opening)

            // So we fetch ALL transactions from Start Date?
            // No, we need ALL transactions AFTER Start Date? No, `start` is the historical point.
            // We need everything AFTER `start`? 
            // Actually, to get Closing from Current, we need everything AFTER `end` up to `now`.
            // To get Report Numbers (Added/Used in period), we need `start` to `end`.

            // So we need: 
            // A: Transactions > End Date (for rollback)
            // B: Transactions Between Start and End (for display)

            const transWhere = {
                date: { [Op.gte]: start } // Fetching potentially more than needed (start->now) is safer/easier
            };

            const allPurchases = await PurchaseOrderItem.findAll({
                include: [{ model: Purchase, as: 'purchase' }]
            }); // Fetching all is heavy? Maybe filter by date?
            // Purchase date is in 'purchase' model.

            // Optimize:
            // We will fetch ALL because JSON distribution logic is complex to filter in SQL for site.
            // But we can filter by date range roughly.

            const allConsumption = await ServiceItem.findAll({
                include: [{
                    association: 'serviceHistory',
                    attributes: ['siteId', 'serviceDate']
                }],
                where: {
                    // optimization: only items with relevant types
                    itemType: { [Op.or]: ['spare', 'drill bit', 'drilling tool'] }
                }
            });

            const report = items.map(item => {
                // Filter relevant transactions
                const itemPurchases = allPurchases.filter(p =>
                    (item.itemType === 'Spare' ? p.spareId === item.id : p.drillingToolId === item.id)
                );
                const itemConsumption = allConsumption.filter(c =>
                    (item.itemType === 'Spare' ? c.spareId === item.id : c.drillingToolId === item.id)
                );

                let inwardAfterEnd = 0;
                let outwardAfterEnd = 0;
                let inwardInPeriod = 0;
                let outwardInPeriod = 0;

                // Process Purchases (Inward)
                itemPurchases.forEach(p => {
                    const pDate = new Date(p.purchase?.date || p.createdAt);
                    let qty = p.quantity;

                    // Site Filter
                    if (siteId) {
                        try {
                            const dist = typeof p.distribution === 'string' ? JSON.parse(p.distribution) : p.distribution;
                            qty = Number(dist?.[siteId] || 0);
                        } catch (e) { qty = 0; }
                    }

                    if (qty > 0) {
                        if (pDate > end) {
                            inwardAfterEnd += qty;
                        } else if (pDate >= start && pDate <= end) {
                            inwardInPeriod += qty;
                        }
                    }
                });

                // Process Consumption (Outward)
                itemConsumption.forEach(c => {
                    const cDate = new Date(c.serviceHistory?.serviceDate || c.createdAt);
                    let qty = c.quantity;

                    if (siteId && c.serviceHistory?.siteId !== siteId) {
                        qty = 0;
                    }

                    if (qty > 0) {
                        if (cDate > end) {
                            outwardAfterEnd += qty;
                        } else if (cDate >= start && cDate <= end) {
                            outwardInPeriod += qty;
                        }
                    }
                });

                // Calculations
                const currentStock = getCurrentQty(item.id, item.itemType);

                // Closing Balance (at End Date)
                // Current = Closing + Inward(After) - Outward(After)
                // Closing = Current - Inward(After) + Outward(After)
                const closingBalance = currentStock - inwardAfterEnd + outwardAfterEnd;

                // Opening Balance (at Start Date)
                // Closing = Opening + Inward(Period) - Outward(Period)
                // Opening = Closing - Inward(Period) + Outward(Period)
                const openingBalance = closingBalance - inwardInPeriod + outwardInPeriod;

                return {
                    id: item.id,
                    itemName: item.name,
                    partNumber: item.partNumber,
                    itemType: item.itemType,
                    groupName: item.groupName,
                    units: 'Nos',
                    openingStock: openingBalance,
                    inward: inwardInPeriod,
                    outward: outwardInPeriod,
                    balance: closingBalance,

                    // Extra for tools
                    totalRPM: item.itemType === 'Drilling Tool' ? item.totalRPM : null,
                    totalMeters: item.itemType === 'Drilling Tool' ? item.totalMeters : null,
                };
            });

            // Filter? No, assume showing all items is better for "Report"
            // Sort by Name
            report.sort((a, b) => a.itemName.localeCompare(b.itemName));

            res.json({ success: true, data: report });
        } catch (error) {
            next(error);
        }
    }
};
