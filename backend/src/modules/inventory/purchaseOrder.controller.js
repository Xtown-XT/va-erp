import PurchaseOrder from "./models/purchaseOrder.model.js";
import PurchaseOrderItem from "./models/purchaseOrderItem.model.js";
import Spares from "../spares/spares.model.js";
import DrillingTools from "../drillingTools/drillingTools.model.js";
import DrillingToolItems from "../drillingTools/drillingToolItems.model.js";
import SiteStock from "./models/siteStock.model.js";
import Supplier from "../supplier/supplier.model.js";
import sequelize from "../../config/db.js";
import Address from "../../modules/address/address.model.js";
import { BaseController } from "../../shared/utils/baseController.js";

class PurchaseOrderController extends BaseController {
    constructor() {
        super(PurchaseOrder);
    }

    // Create PO with Items
    createPO = async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const {
                supplierId, date, remark, items, gstPercent,
                gstInclude, addressId, shippingAddressId, notes
            } = req.body;

            // Generate PO Number (Simple Logic: PO-TIMESTAMP or Count)
            // Use date year for resetting count? Or purely incremental? 
            // Legacy uses VA/YY-YY/001 format logic.
            // Using count + 1 for now or `generateRef` call?
            // User requested "one Po should create only one PO". 
            // Better to rely on what user sends if they called generate-ref, OR generating here safely.
            // If `req.body.orderNumber` is present, use it?

            let poNumber = req.body.orderNumber;
            if (!poNumber) {
                const count = await PurchaseOrder.count({ paranoid: false }); // Count all including deleted to avoid collision?
                poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
            }

            let totalAmount = 0;
            // Calculate total
            items.forEach(item => {
                totalAmount += Number(item.totalPrice || (item.quantity * item.rate));
            });
            // If GST included/excluded calculation happens frontend, here we store the final Total Amount for the PO.
            // But we should probably recalculate valid totals? 
            // For now trusting payload total logic or simple sum.

            const po = await PurchaseOrder.create({
                poNumber,
                supplierId,
                date: date || new Date(),
                remarks: remark || notes, // Frontend sends 'notes'
                gstPercent,
                gstInclude: gstInclude || false,
                addressId,
                shippingAddressId,
                totalAmount,
                status: 'Pending',
                createdBy: req.user.username,
                updatedBy: req.user.username
            }, { transaction: t });

            if (items && items.length > 0) {
                const poItems = items.map(item => ({
                    purchaseOrderId: po.id,
                    itemType: item.itemType || (item.item?.itemType) || 'spare', // Fallback
                    spareId: (item.itemType === 'spare' || !item.itemType) ? item.itemId : null,
                    drillingToolId: item.itemType === 'drillingTool' ? item.itemId : null,
                    quantity: item.quantity,
                    unitPrice: item.rate || item.unitPrice,
                    totalPrice: item.total || ((item.rate || item.unitPrice) * item.quantity)
                }));
                await PurchaseOrderItem.bulkCreate(poItems, { transaction: t });
            }

            // Fetch with associations to return
            const newPO = await PurchaseOrder.findByPk(po.id, {
                include: [
                    { model: Supplier, as: 'supplier' },
                    { model: Address, as: 'address' },
                    { model: Address, as: 'shippingAddress' },
                    {
                        model: PurchaseOrderItem,
                        as: 'items',
                        include: [
                            { model: Spares, as: 'spare' },
                            { model: DrillingTools, as: 'drillingTool' }
                        ],
                        transaction: t
                    }
                ],
                transaction: t
            });

            await t.commit();

            res.status(201).json({ success: true, message: "Purchase Order created successfully", data: newPO });

        } catch (error) {
            console.error("Create PO Error:", error);
            if (!t.finished) {
                await t.rollback();
            }
            res.status(500).json({ success: false, message: error.message, error });
        }
    };

    getAllPOs = async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 1000; // Default high limit if not paginated
            const offset = (page - 1) * limit;

            const { count, rows } = await PurchaseOrder.findAndCountAll({
                distinct: true, // Fix for duplicate rows when including hasMany
                include: [
                    { model: Supplier, as: 'supplier' },
                    { model: Address, as: 'address' },
                    { model: Address, as: 'shippingAddress' },
                    { model: PurchaseOrderItem, as: 'items', include: [{ model: Spares, as: 'spare' }, { model: DrillingTools, as: 'drillingTool' }] }
                    // Note: 'items' include might still cause row multiplication in raw SQL but 'distinct: true' on primary key handles count.
                ],
                order: [['createdAt', 'DESC']],
                limit,
                offset
            });

            res.json({
                success: true,
                message: "Fetched POs",
                data: rows,
                total: count,
                page,
                limit
            });
        } catch (error) {
            console.error("Get POs Error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    getPOById = async (req, res) => {
        try {
            const { id } = req.params;
            const po = await PurchaseOrder.findByPk(id, {
                include: [
                    { model: Supplier, as: 'supplier' },
                    { model: Address, as: 'address' },
                    { model: Address, as: 'shippingAddress' },
                    {
                        model: PurchaseOrderItem,
                        as: 'items',
                        include: [
                            { model: Spares, as: 'spare' },
                            { model: DrillingTools, as: 'drillingTool' }
                        ]
                    }
                ]
            });
            if (!po) return res.status(404).json({ success: false, message: "PO not found" });

            // Map items to match legacy structure if needed (poItems)
            // But standardizing on 'items' is better. 
            // The frontend code expects 'poItems' in some places, but we can transform there or here.
            // Let's send exactly what model structure is.

            const poData = po.toJSON();
            // Transform for frontend 'items' compatibility if needed
            poData.poItems = poData.items.map(i => ({
                id: i.id,
                itemId: i.spareId || i.drillingToolId,
                quantity: i.quantity,
                rate: i.unitPrice,
                total: i.totalPrice,
                item: i.spare || i.drillingTool // generic 'item' field with name
            }));

            res.json({ success: true, data: poData });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    deletePO = async (req, res) => {
        try {
            const { id } = req.params;
            const po = await PurchaseOrder.findByPk(id);
            if (!po) return res.status(404).json({ success: false, message: "PO not found" });

            if (po.status === 'Received') {
                return res.status(400).json({ success: false, message: "Cannot delete a Received PO." });
            }

            await po.destroy(); // Hard delete since paranoid is false in model
            res.json({ success: true, message: "PO deleted successfully" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    generatePOReference = async (req, res) => {
        try {
            const count = await PurchaseOrder.count({ paranoid: false });
            const year = new Date().getFullYear();
            const nextYear = year + 1;
            const shortYear = year.toString().slice(-2);
            const shortNextYear = nextYear.toString().slice(-2);
            // Format: VA/YY-YY/XXX
            // e.g. VA/25-26/001
            const refNo = `VA/${shortYear}-${shortNextYear}/${String(count + 1).padStart(3, '0')}`;
            res.json({ success: true, refNo });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // Receive PO
    receivePO = async (req, res) => {
        const { id } = req.params;
        const { distribution } = req.body;

        const t = await sequelize.transaction();
        try {
            const po = await PurchaseOrder.findByPk(id, {
                include: [{ model: PurchaseOrderItem, as: 'items' }]
            });

            if (!po) return res.status(404).json({ success: false, message: "PO not found" });
            if (po.status === 'Received') return res.status(400).json({ success: false, message: "PO already received" });

            // Process each item
            if (distribution) {
                for (const item of po.items) {
                    const itemDist = distribution[item.id];
                    if (!itemDist) continue;

                    for (const dist of itemDist) {
                        const qty = Number(dist.quantity);
                        if (item.itemType === 'spare' || item.spareId || item.itemType === 'drillingTool' || item.drillingToolId) {
                            // Unified stock update for Spares and Drilling Tools
                            const whereClause = { siteId: dist.siteId };
                            if (item.itemType === 'spare' || item.spareId) whereClause.spareId = item.spareId;
                            if (item.itemType === 'drillingTool' || item.drillingToolId) whereClause.drillingToolId = item.drillingToolId;

                            const existingStock = await SiteStock.findOne({
                                where: whereClause,
                                transaction: t
                            });

                            if (existingStock) {
                                await existingStock.increment('quantity', { by: qty, transaction: t });
                            } else {
                                await SiteStock.create({
                                    siteId: dist.siteId,
                                    spareId: item.spareId || null,
                                    drillingToolId: item.drillingToolId || null,
                                    quantity: qty,
                                    createdBy: req.user.username,
                                    updatedBy: req.user.username
                                }, { transaction: t });
                            }
                        }
                    }
                }
            }

            await po.update({
                status: 'Received',
                receivedBy: req.user.username,
                receivedAt: new Date()
            }, { transaction: t });

            await t.commit();
            return res.json({ success: true, message: "PO Received and Stock Updated", data: { po } });

        } catch (error) {
            console.error("Receive PO Error:", error);
            if (!t.finished) {
                await t.rollback();
            }
            return res.status(500).json({ success: false, message: error.message });
        }
    };
}

export default new PurchaseOrderController();
