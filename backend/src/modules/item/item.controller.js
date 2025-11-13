import Item from "./item.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";
import { Op } from "sequelize";

// 1. Create CRUD service from model
const ItemCrud = new BaseCrud(Item);

// 2. Custom controller with stock calculations
class ItemCustomController extends BaseController {
  constructor(crud, modelName) {
    super(crud, modelName);
  }

  // Override create to always create 1 item at a time
  create = async (req, res, next) => {
    try {
      const { canBeFitted, stock, itemName, partNumber, currentRPM, nextServiceRPM, ...otherData } = req.body;
      const createdBy = req.user?.username || "system";

      if (canBeFitted) {
        // Fittable item - always create 1 item at a time
        // Generate modelName by finding the next available number
        const existingItems = await Item.findAll({
          where: {
            itemName,
            partNumber,
            canBeFitted: true,
          },
          attributes: ['modelName'],
          order: [['modelName', 'DESC']],
        });

        // Extract numbers from existing modelNames and find the highest
        let nextNumber = 1;
        if (existingItems.length > 0) {
          const numbers = existingItems
            .map(item => {
              const match = item.modelName?.match(/-(\d+)$/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => !isNaN(n));
          
          if (numbers.length > 0) {
            nextNumber = Math.max(...numbers) + 1;
          }
        }

        const modelName = `${itemName}-${String(nextNumber).padStart(3, '0')}`;
        
        const item = await Item.create({
          ...otherData,
          itemName,
          partNumber,
          canBeFitted: true,
          modelName,
          status: 'in_stock',
          currentRPM: currentRPM !== undefined ? Number(currentRPM) : 0,
          nextServiceRPM: nextServiceRPM !== undefined ? Number(nextServiceRPM) : null,
          stock: null, // Don't store stock for fittable items
          createdBy,
        });

        return res.status(201).json({
          success: true,
          message: "Item created successfully",
          data: item,
        });
      } else {
        // Non-fittable item - create single row
        const item = await Item.create({
          ...otherData,
          itemName,
          partNumber,
          canBeFitted: false,
          stock: stock !== undefined ? Number(stock) : 1,
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

  // Override getAll to group fittable items and calculate stock
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, search, groupName, canBeFitted } = req.query;
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
      if (canBeFitted !== undefined) {
        where.canBeFitted = canBeFitted === 'true';
      }

      // For fittable items, we need to group by itemName+partNumber
      // For non-fittable, show normally
      if (canBeFitted === 'true') {
        // Get all fittable items
        const allItems = await Item.findAll({
          where: { ...where, canBeFitted: true },
          order: [['itemName', 'ASC'], ['modelName', 'ASC']],
        });

        // Group by itemName + partNumber
        const grouped = {};
        allItems.forEach(item => {
          const key = `${item.itemName}|${item.partNumber}`;
          if (!grouped[key]) {
            grouped[key] = {
              itemName: item.itemName,
              partNumber: item.partNumber,
              groupName: item.groupName,
              units: item.units,
              purchaseRate: item.purchaseRate,
              gst: item.gst,
              canBeFitted: true,
              stock: 0, // Will calculate
              in_stock: 0,
              fitted: 0,
              removed: 0,
              items: [],
            };
          }
          grouped[key].items.push(item);
          if (item.status === 'in_stock') grouped[key].in_stock++;
          else if (item.status === 'fitted') grouped[key].fitted++;
          else if (item.status === 'removed') grouped[key].removed++;
        });

        // Calculate stock and format
        const groupedItems = Object.values(grouped).map(group => ({
          ...group,
          stock: group.in_stock, // Stock = count of in_stock items
          id: group.items[0]?.id, // Use first item's ID for reference
        }));

        // Apply pagination
        const total = groupedItems.length;
        const paginated = groupedItems.slice(offset, offset + parseInt(limit));

        return res.json({
          success: true,
          data: paginated,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
        });
      } else if (canBeFitted === 'false') {
        // Non-fittable items - show normally
        const { count, rows: items } = await Item.findAndCountAll({
          where: { ...where, canBeFitted: false },
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [['createdAt', 'DESC']],
        });

        return res.json({
          success: true,
          data: items,
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
        });
      } else {
        // No filter - return all items (both fittable and non-fittable)
        // Get fittable items grouped
        const fittableItems = await Item.findAll({
          where: { ...where, canBeFitted: true },
          order: [['itemName', 'ASC'], ['modelName', 'ASC']],
        });

        // Group fittable items
        const grouped = {};
        fittableItems.forEach(item => {
          const key = `${item.itemName}|${item.partNumber}`;
          if (!grouped[key]) {
            grouped[key] = {
              itemName: item.itemName,
              partNumber: item.partNumber,
              groupName: item.groupName,
              units: item.units,
              purchaseRate: item.purchaseRate,
              gst: item.gst,
              canBeFitted: true,
              stock: 0,
              in_stock: 0,
              fitted: 0,
              removed: 0,
              items: [],
            };
          }
          grouped[key].items.push(item);
          if (item.status === 'in_stock') grouped[key].in_stock++;
          else if (item.status === 'fitted') grouped[key].fitted++;
          else if (item.status === 'removed') grouped[key].removed++;
        });

        const groupedFittable = Object.values(grouped).map(group => ({
          ...group,
          stock: group.in_stock,
          id: group.items[0]?.id,
        }));

        // Get non-fittable items
        const { count: nonFittableCount, rows: nonFittableItems } = await Item.findAndCountAll({
          where: { ...where, canBeFitted: false },
          order: [['createdAt', 'DESC']],
        });

        // Combine both
        const allItemsCombined = [...groupedFittable, ...nonFittableItems];
        const total = allItemsCombined.length;
        const paginated = allItemsCombined.slice(offset, offset + parseInt(limit));

        return res.json({
          success: true,
          data: paginated,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
        });
      }
    } catch (error) {
      next(error);
    }
  };

  // Get available items for fitting (canBeFitted=true, status='in_stock')
  getAvailableForFitting = async (req, res, next) => {
    try {
      const { search, limit = 1000 } = req.query;
      const where = {
        canBeFitted: true,
        status: 'in_stock',
      };

      if (search) {
        where[Op.or] = [
          { itemName: { [Op.iLike]: `%${search}%` } },
          { partNumber: { [Op.iLike]: `%${search}%` } },
          { modelName: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const items = await Item.findAll({
        where,
        limit: parseInt(limit),
        order: [['itemName', 'ASC'], ['modelName', 'ASC']],
      });

      // Enhance response with display labels
      const enhancedItems = items.map(item => ({
        ...item.toJSON(),
        displayLabel: `${item.itemName} (${item.partNumber}) - ${item.modelName}`,
        lastUsedCount: item.currentRPM || 0,
        currentCount: item.currentRPM || 0,
        balance: 1, // Always 1 for in_stock items
      }));

      return res.json({
        success: true,
        data: enhancedItems,
        total: enhancedItems.length,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const ItemController = new ItemCustomController(ItemCrud, "Item");
