import Item from "./item.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";
import { Op } from "sequelize";

// 1. Create CRUD service from model
const ItemCrud = new BaseCrud(Item);

// 2. Custom controller with inventory tracking
class ItemCustomController extends BaseController {
  constructor(crud, modelName) {
    super(crud, modelName);
  }

  // Helper: Get current month in YYYY-MM format
  getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Override create to handle item types and inventory
  create = async (req, res, next) => {
    try {
      const { itemType, stock = 0, itemName, partNumber, ...otherData } = req.body;
      const createdBy = req.user?.username || "system";
      const currentMonth = this.getCurrentMonth();

      // For drilling tools, auto-generate unique part numbers for each unit
      if (itemType === "Drilling Tools") {
        const createdItems = [];
        const quantity = Math.floor(stock);

        for (let i = 0; i < quantity; i++) {
          // Find next available part number
          const existingItems = await Item.findAll({
            where: {
              itemName,
              itemType: "Drilling Tools",
            },
            attributes: ['partNumber'],
            order: [['partNumber', 'DESC']],
          });

          let nextNumber = 1;
          if (existingItems.length > 0) {
            const numbers = existingItems
              .map(item => {
                const match = item.partNumber?.match(/-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
              })
              .filter(n => !isNaN(n));
            
            if (numbers.length > 0) {
              nextNumber = Math.max(...numbers) + 1;
            }
          }

          const uniquePartNumber = `${partNumber}-${String(nextNumber).padStart(3, '0')}`;
          const modelName = `${itemName}-${String(nextNumber).padStart(3, '0')}`;

          const item = await Item.create({
            ...otherData,
            itemName,
            partNumber: uniquePartNumber,
            modelName,
            itemType,
            openingStock: 1,
            inward: 0,
            outward: 0,
            balance: 1,
            stock: 1,
            currentMonth,
            createdBy,
          });

          createdItems.push(item);
        }

        return res.status(201).json({
          success: true,
          message: `${createdItems.length} drilling tool(s) created successfully`,
          data: createdItems,
        });
      } else {
        // Regular item - create single row with stock tracking
        const item = await Item.create({
          ...otherData,
          itemName,
          partNumber,
          itemType,
          openingStock: Number(stock),
          inward: 0,
          outward: 0,
          balance: Number(stock),
          stock: Number(stock),
          currentMonth,
          createdBy,
        });

        return res.status(201).json({
          success: true,
          message: "Item created successfully",
          data: item,
        });
      }
    } catch (error) {
      next(error);
    }
  };

  // Override getAll to show items with inventory tracking
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, search, groupName, itemType } = req.query;
      const offset = (page - 1) * limit;

      const where = {};
      if (search) {
        where[Op.or] = [
          { itemName: { [Op.iLike]: `%${search}%` } },
          { partNumber: { [Op.iLike]: `%${search}%` } },
          { groupName: { [Op.iLike]: `%${search}%` } },
          { modelName: { [Op.iLike]: `%${search}%` } },
        ];
      }
      if (groupName) {
        where.groupName = groupName;
      }
      if (itemType) {
        where.itemType = itemType;
      }

      const { count, rows: items } = await Item.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['itemType', 'ASC'], ['itemName', 'ASC']],
      });

      return res.json({
        success: true,
        data: items,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (error) {
      next(error);
    }
  };

  // Get items by type
  getByType = async (req, res, next) => {
    try {
      const { itemType } = req.params;
      const { search, limit = 1000 } = req.query;

      const where = { itemType };

      if (search) {
        where[Op.or] = [
          { itemName: { [Op.iLike]: `%${search}%` } },
          { partNumber: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const items = await Item.findAll({
        where,
        limit: parseInt(limit),
        order: [['itemName', 'ASC'], ['partNumber', 'ASC']],
      });

      return res.json({
        success: true,
        data: items,
        total: items.length,
      });
    } catch (error) {
      next(error);
    }
  };

  // Initialize month - set opening stock from previous balance
  initializeMonth = async (req, res, next) => {
    const transaction = await Item.sequelize.transaction();
    try {
      const username = req.user?.username || "system";
      const currentMonth = this.getCurrentMonth();

      // Get all items
      const items = await Item.findAll({ transaction });

      // Update each item
      for (const item of items) {
        await item.update(
          {
            openingStock: item.balance,
            inward: 0,
            outward: 0,
            currentMonth,
            updatedBy: username,
          },
          { transaction }
        );
      }

      await transaction.commit();

      return res.json({
        success: true,
        message: `Month initialized for ${items.length} items`,
        data: {
          month: currentMonth,
          itemsUpdated: items.length,
        },
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  };

  // Get monthly inventory report
  getMonthlyReport = async (req, res, next) => {
    try {
      const { month, year, itemType } = req.query;
      
      if (!month || !year) {
        return res.status(400).json({
          success: false,
          message: "Month and year are required",
        });
      }

      const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
      const where = { currentMonth: targetMonth };

      if (itemType) {
        where.itemType = itemType;
      }

      const items = await Item.findAll({
        where,
        order: [['itemType', 'ASC'], ['itemName', 'ASC']],
      });

      // Calculate totals
      const totals = {
        totalOpeningStock: 0,
        totalInward: 0,
        totalOutward: 0,
        totalBalance: 0,
      };

      items.forEach(item => {
        totals.totalOpeningStock += Number(item.openingStock) || 0;
        totals.totalInward += Number(item.inward) || 0;
        totals.totalOutward += Number(item.outward) || 0;
        totals.totalBalance += Number(item.balance) || 0;
      });

      return res.json({
        success: true,
        data: items,
        totals,
        month: targetMonth,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get items available for service (with balance > 0)
  getAvailableForService = async (req, res, next) => {
    try {
      const { itemType } = req.query;
      
      if (!itemType) {
        return res.status(400).json({
          success: false,
          message: "Item type is required",
        });
      }

      const items = await Item.findAll({
        where: {
          itemType,
          balance: { [Op.gt]: 0 }
        },
        order: [['itemName', 'ASC'], ['partNumber', 'ASC']],
        attributes: ['id', 'itemName', 'partNumber', 'units', 'balance', 'itemType', 'modelName', 'currentRPM', 'currentMeter']
      });

      return res.json({
        success: true,
        data: items,
        total: items.length
      });
    } catch (error) {
      next(error);
    }
  };
}

export const ItemController = new ItemCustomController(ItemCrud, "Item");
