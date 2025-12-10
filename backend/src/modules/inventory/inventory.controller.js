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
                    category: s.spare?.category
                }));

                const tools = stocks.filter(s => s.drillingToolId).map(s => ({
                    id: s.id,
                    toolId: s.drillingToolId,
                    name: s.drillingTool?.name,
                    quantity: s.quantity,
                    partNumber: s.drillingTool?.partNumber,
                    totalRPM: s.drillingTool?.totalRPM,
                    totalMeter: s.drillingTool?.totalMeter,
                    price: s.drillingTool?.price
                }));

                return {
                    siteId: site.id,
                    siteName: site.siteName,
                    sparesCount: spares.reduce((sum, s) => sum + s.quantity, 0),
                    toolsCount: tools.length,
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

            // Handle Drilling Tool Instance Creation
            if (drillingToolId && (mode === 'add' || quantity > 0)) {
                // For tools, we expect adding 1 at a time (quantity is ignored or assumed 1)
                // If adding stock, require serialNumber
                if (serialNumber) {
                    // Check existing SN
                    const existingInstance = await DrillingToolItems.findOne({ where: { serialNumber } });
                    if (existingInstance) {
                        await t.rollback();
                        return res.status(400).json({ success: false, message: `Serial Number '${serialNumber}' already exists` });
                    }

                    await DrillingToolItems.create({
                        drillingToolId,
                        siteId,
                        serialNumber,
                        currentRpm: initialRPM || 0,
                        currentMeter: initialMeter || 0,
                        status: 'In Stock'
                    }, { transaction: t });
                } else if (!serialNumber && drillingToolId) {
                    // If no serial number but drillingToolId is there, maybe it's just a count update? 
                    // User rule: "drilling tool is always count 1 not bulk".
                    // We should enforce SN.
                    await t.rollback();
                    return res.status(400).json({ success: false, message: "Serial Number is required for Drilling Tools" });
                }
            }

            // Update Aggregate SiteStock (common for both Spares and Tools for summary)
            let stock = await SiteStock.findOne({
                where: {
                    siteId,
                    ...(spareId ? { spareId } : {}),
                    ...(drillingToolId ? { drillingToolId } : {})
                },
                transaction: t
            });

            const qtyChange = drillingToolId ? 1 : quantity; // Force 1 for tool additions

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
            const end = endDate ? new Date(endDate) : new Date();

            // 1. Get Base Items (Spares and DrillingTools)
            let items = [];
            if (!itemType || itemType === 'spares' || itemType === 'all') {
                const spares = await Spares.findAll({ lean: true });
                items = [...items, ...spares.map(s => ({ ...s.dataValues, itemType: 'Spare', groupName: s.category }))];
            }
            if (!itemType || itemType === 'Drilling Tools' || itemType === 'all') {
                const tools = await DrillingTools.findAll({ lean: true });
                items = [...items, ...tools.map(t => ({ ...t.dataValues, itemType: 'Drilling Tool', groupName: t.type }))];
            }

            // 2. Fetch Purchases (Inward)
            const purchaseWhere = {
                createdAt: { [Op.gte]: start } // We need history for opening balance? No, we need ALL history for opening?
                // Logic: Opening = Sum(In) - Sum(Out) BEFORE start date.
                // Inward = Sum(In) BETWEEN start and end.
                // Outward = Sum(Out) BETWEEN start and end.
                // Balance = Opening + Inward - Outward.
            };

            // To calculate Opening Stock correctly, we need ALL transactions.
            // But fetching ALL transactions might be heavy.
            // Alternative: Use Current Stock from SiteStock table as "Closing Balance" and work backwards?
            // Current Stock = Opening + Inward - Outward (Total History)
            // Opening (at start date) = Current - Inward(Since start) + Outward(Since start) ??
            // OR: Opening = Sum(In before start) - Sum(Out before start).
            // Let's stick to Sum method for accuracy if volume is low.

            const allPurchases = await PurchaseOrderItem.findAll({
                include: [{ model: Purchase, as: 'purchase' }]
            });

            const allConsumption = await ServiceItem.findAll({
                include: [{
                    association: 'serviceHistory',
                    attributes: ['siteId', 'date']
                }]
            });

            // Filter by Site if requested
            // Purchases are global usually? No, PO items are distributed to sites.
            // PurchaseOrderItem has `distribution` JSON field: { "siteId": qty, ... }
            // ServiceItem has serviceHistory.siteId.

            const report = items.map(item => {
                // INWARD (Purchases)
                // Filter purchases for this item
                const itemPurchases = allPurchases.filter(p =>
                    (item.itemType === 'Spare' ? p.spareId === item.id : p.drillingToolId === item.id)
                );

                // OUTWARD (Consumption)
                const itemConsumption = allConsumption.filter(c =>
                    (item.itemType === 'Spare' ? c.spareId === item.id : c.drillingToolId === item.id)
                );

                // Calculate Totals based on Site Filter and Date Ranges
                let openingIn = 0;
                let openingOut = 0;
                let periodIn = 0;
                let periodOut = 0;

                // Process Inward (Purchases)
                itemPurchases.forEach(p => {
                    const pDate = new Date(p.purchase?.date || p.createdAt);
                    let qty = p.quantity;

                    if (siteId) {
                        // If site filter, check distribution
                        try {
                            const dist = typeof p.distribution === 'string' ? JSON.parse(p.distribution) : p.distribution;
                            qty = Number(dist?.[siteId] || 0);
                        } catch (e) {
                            qty = 0;
                        }
                    }

                    if (qty > 0) {
                        if (pDate < start) {
                            openingIn += qty;
                        } else if (pDate >= start && pDate <= end) {
                            periodIn += qty;
                        }
                    }
                });

                // Process Outward (Consumption)
                itemConsumption.forEach(c => {
                    const cDate = new Date(c.serviceHistory?.date || c.createdAt);
                    let qty = c.quantity;

                    // Filter by site
                    if (siteId && c.serviceHistory?.siteId !== siteId) {
                        qty = 0;
                    }

                    if (qty > 0) {
                        if (cDate < start) {
                            openingOut += qty;
                        } else if (cDate >= start && cDate <= end) {
                            periodOut += qty;
                        }
                    }
                });

                const openingStock = openingIn - openingOut;
                const closingStock = openingStock + periodIn - periodOut;

                return {
                    id: item.id,
                    itemName: item.name,
                    partNumber: item.partNumber,
                    itemType: item.itemType,
                    groupName: item.groupName,
                    units: 'Nos', // Default
                    openingStock,
                    inward: periodIn,
                    outward: periodOut,
                    balance: closingStock,
                    totalRPM: item.itemType === 'Drilling Tool' ? item.totalRPM : null,
                    totalMeter: item.itemType === 'Drilling Tool' ? item.totalMeter : null,
                };
            });

            // Filter out items with no activity if needed? Or show all?
            // User likely wants to see stock even if 0 activity.

            res.json({ success: true, data: report });
        } catch (error) {
            next(error);
        }
    }
};
