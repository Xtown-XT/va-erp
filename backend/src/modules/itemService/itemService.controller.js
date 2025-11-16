import ItemService from "./itemService.model.js";
import Item from "../item/item.model.js";
import Machine from "../vehicle/vehicle.model.js";
import Compressor from "../compressor/compressor.model.js";
import DailyEntry from "../dailyEntry/dailyEntry.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";
import { Op } from "sequelize";

// Create CRUD service
const ItemServiceCrud = new BaseCrud(ItemService);

// Custom controller
class ItemServiceCustomController extends BaseController {
  constructor() {
    super(ItemServiceCrud, "ItemService");
  }

  // Get currently fitted items
  getFitted = async (req, res, next) => {
    try {
      const { vehicleId, compressorId, serviceType } = req.query;
      
      const where = { status: "fitted" };
      
      if (vehicleId) {
        where.vehicleId = vehicleId;
      }
      if (compressorId) {
        where.compressorId = compressorId;
      }
      if (serviceType) {
        where.serviceType = serviceType;
      }

      const fittedItems = await ItemService.findAll({
        where,
        include: [
          {
            model: Item,
            as: "item",
          },
          {
            model: Machine,
            as: "machine",
            required: false,
          },
          {
            model: Compressor,
            as: "compressor",
            required: false,
          },
          {
            model: DailyEntry,
            as: "dailyEntry",
            required: false,
          },
        ],
        order: [["fittedDate", "DESC"]],
      });

      return res.json({
        success: true,
        data: fittedItems,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get fitted items by machine
  getByMachine = async (req, res, next) => {
    try {
      const { vehicleId } = req.params;
      
      const fittedItems = await ItemService.findAll({
        where: {
          vehicleId,
          status: "fitted",
        },
        include: [
          {
            model: Item,
            as: "item",
          },
        ],
        order: [["fittedDate", "DESC"]],
      });

      return res.json({
        success: true,
        data: fittedItems,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get fitted items by compressor
  getByCompressor = async (req, res, next) => {
    try {
      const { compressorId } = req.params;
      
      const fittedItems = await ItemService.findAll({
        where: {
          compressorId,
          status: "fitted",
        },
        include: [
          {
            model: Item,
            as: "item",
          },
        ],
        order: [["fittedDate", "DESC"]],
      });

      return res.json({
        success: true,
        data: fittedItems,
      });
    } catch (error) {
      next(error);
    }
  };

  // Fit an item (create ItemService record and update inventory)
  fit = async (req, res, next) => {
    const transaction = await ItemService.sequelize.transaction();
    try {
      const {
        itemId,
        dailyEntryId,
        vehicleId,
        compressorId,
        serviceType,
        fittedDate,
        fittedRPM,
        fittedMeter,
        quantity = 1,
      } = req.body;
      
      const username = req.user?.username || "system";

      // Verify item exists and has sufficient stock
      const item = await Item.findByPk(itemId, { transaction });
      if (!item) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Item not found",
        });
      }

      if (item.balance < quantity) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Insufficient stock balance",
        });
      }

      // Create ItemService record
      const itemService = await ItemService.create(
        {
          itemId,
          dailyEntryId,
          vehicleId,
          compressorId,
          serviceType,
          fittedDate,
          fittedRPM,
          fittedMeter,
          quantity,
          status: "fitted",
          createdBy: username,
        },
        { transaction }
      );

      // Update item inventory (outward and balance)
      await item.update(
        {
          outward: item.outward + quantity,
          balance: item.balance - quantity,
          updatedBy: username,
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(201).json({
        success: true,
        message: "Item fitted successfully",
        data: itemService,
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  };

  // Remove a fitted item (update ItemService record)
  remove = async (req, res, next) => {
    const transaction = await ItemService.sequelize.transaction();
    try {
      const { id } = req.params;
      const { removedDate, removedRPM, removedMeter } = req.body;
      const username = req.user?.username || "system";

      const itemService = await ItemService.findByPk(id, { transaction });
      if (!itemService) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "ItemService record not found",
        });
      }

      if (itemService.status === "removed") {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Item already removed",
        });
      }

      // Calculate totals
      const totalRPMRun = removedRPM - itemService.fittedRPM;
      const totalMeterRun = removedMeter && itemService.fittedMeter 
        ? removedMeter - itemService.fittedMeter 
        : null;

      // Update ItemService record
      await itemService.update(
        {
          removedDate,
          removedRPM,
          removedMeter,
          totalRPMRun,
          totalMeterRun,
          status: "removed",
          updatedBy: username,
        },
        { transaction }
      );

      await transaction.commit();

      return res.json({
        success: true,
        message: "Item removed successfully",
        data: itemService,
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  };

  // Get usage report
  getUsageReport = async (req, res, next) => {
    try {
      const { startDate, endDate, vehicleId, compressorId, itemId } = req.query;
      
      const where = {};
      
      if (startDate && endDate) {
        where.fittedDate = {
          [Op.between]: [startDate, endDate],
        };
      } else if (startDate) {
        where.fittedDate = {
          [Op.gte]: startDate,
        };
      } else if (endDate) {
        where.fittedDate = {
          [Op.lte]: endDate,
        };
      }
      
      if (vehicleId) {
        where.vehicleId = vehicleId;
      }
      if (compressorId) {
        where.compressorId = compressorId;
      }
      if (itemId) {
        where.itemId = itemId;
      }

      const usageRecords = await ItemService.findAll({
        where,
        include: [
          {
            model: Item,
            as: "item",
          },
          {
            model: Machine,
            as: "machine",
            required: false,
          },
          {
            model: Compressor,
            as: "compressor",
            required: false,
          },
          {
            model: DailyEntry,
            as: "dailyEntry",
            required: false,
          },
        ],
        order: [["fittedDate", "DESC"]],
      });

      return res.json({
        success: true,
        data: usageRecords,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const ItemServiceController = new ItemServiceCustomController();

