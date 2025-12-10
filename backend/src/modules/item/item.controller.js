import Spares from "../spares/spares.model.js";
import DrillingTools from "../drillingTools/drillingTools.model.js";
import SiteStock from "../inventory/models/siteStock.model.js";
import { Op } from "sequelize";

export const ItemController = {
    getByType: async (req, res, next) => {
        try {
            const { type } = req.params; // "Drilling Tools", "all", or others (Spares)
            const { siteId } = req.query;

            let items = [];
            let stocks = [];

            // 1. Fetch Master Data based on Type
            if (type === "all") {
                const [spares, tools] = await Promise.all([
                    Spares.findAll({ raw: true }),
                    DrillingTools.findAll({ raw: true })
                ]);

                // Map to common structure immediately or keep separate?
                // The controller merges logic below. Let's merge array.
                // We need to tag them to distinguish later if needed, but the loop below relies on type check.
                // We can't easily rely on type check if mixed. 
                // Let's Just map properties here.

                const mappedSpares = spares.map(i => ({ ...i, _type: 'spare' }));
                const mappedTools = tools.map(i => ({ ...i, _type: 'drillingTool' }));
                items = [...mappedSpares, ...mappedTools];

            } else if (type === "Drilling Tools") {
                const tools = await DrillingTools.findAll({ raw: true });
                items = tools.map(i => ({ ...i, _type: 'drillingTool' }));
            } else {
                // Assume Spares
                const spares = await Spares.findAll({ raw: true });
                items = spares.map(i => ({ ...i, _type: 'spare' }));
            }

            // Convert sequlize instances to plain objects if not using lean (Sequelize model instances need .get())
            items = items.map(i => i.get ? i.get({ plain: true }) : i);

            // 2. Fetch Stock if siteId is provided
            if (siteId) {
                // Logic becomes complex for mixed 'all'. 
                // If siteId provided, we need All stocks?
                // For 'all', we might just fetch ALL stocks for that site.

                const stockWhere = { siteId };
                // Optimization: fetch all stocks for site, then match in memory.
                stocks = await SiteStock.findAll({
                    where: stockWhere,
                    raw: true
                });
            }

            // 3. Merge Stock Balance and Normalize Response
            const result = items.map(item => {
                let stockEntry;
                if (item._type === 'drillingTool') {
                    stockEntry = stocks.find(s => s.drillingToolId === item.id);
                } else {
                    stockEntry = stocks.find(s => s.spareId === item.id);
                }

                return {
                    id: item.id,
                    itemName: item.name,
                    partNumber: item.partNumber,
                    serialNumber: item.serialNumber, // Tools
                    price: item.price || item.currentPrice, // Spares vs Tools might differ? Spares has price. Tools?
                    units: item.units,
                    currentRPM: item.totalRPM || 0,
                    currentMeter: item.totalMeter || 0,
                    balance: stockEntry ? stockEntry.quantity : 0,
                    itemType: item._type === 'drillingTool' ? "Drilling Tool" : "Spare",
                    type: item._type === 'drillingTool' ? "Drilling Tool" : "Spare" // For frontend compat
                };
            });

            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
};
