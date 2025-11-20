import Machine from "./vehicle.model.js";
import Item from "../item/item.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";
import { Sequelize } from "sequelize";

// 1. Create CRUD service from model
const MachineCrud = new BaseCrud(Machine);

// 2. Extend BaseController to handle cascade deletion of fitted items
class MachineController extends BaseController {
  constructor() {
    super(MachineCrud, "Machine");
  }

  // Override softDelete to handle fitted items
  softDelete = async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Unfit all items fitted to this machine
      await Item.update(
        { 
          status: 'in_stock',
          fittedToVehicleId: null,
          fittedDate: null,
          removedDate: new Date().toISOString().split('T')[0],
          updatedBy: req.user?.username || 'system'
        },
        { 
          where: { 
            fittedToVehicleId: id,
            status: 'fitted',
            canBeFitted: true
          } 
        }
      );

      // Continue with normal soft delete
      return super.softDelete(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  // Override hardDelete to handle fitted items
  hardDelete = async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Unfit all items fitted to this machine
      await Item.update(
        { 
          status: 'in_stock',
          fittedToVehicleId: null,
          fittedDate: null,
          removedDate: new Date().toISOString().split('T')[0],
          updatedBy: req.user?.username || 'system'
        },
        { 
          where: { 
            fittedToVehicleId: id,
            status: 'fitted',
            canBeFitted: true
          } 
        }
      );

      // Continue with normal hard delete
      return super.hardDelete(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  // Override getAll to sort by vehicleNumber using natural numeric sort
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const { limit: l, offset, page: safePage } = BaseCrud.paginate(page, limit);

      // Extract numeric part from vehicleNumber (e.g., "VA-1" -> 1, "VA-10" -> 10)
      // For MySQL: Get part after hyphen and cast to integer, fallback to 999999 if no number found
      const numericSort = Sequelize.literal(`
        CAST(
          CASE 
            WHEN SUBSTRING_INDEX(vehicleNumber, '-', -1) REGEXP '^[0-9]+$'
            THEN CAST(SUBSTRING_INDEX(vehicleNumber, '-', -1) AS UNSIGNED)
            ELSE 999999
          END AS UNSIGNED
        )
      `);

      const { rows, count } = await Machine.findAndCountAll({
        limit: l,
        offset,
        order: [
          [numericSort, 'ASC'],
          ['vehicleNumber', 'ASC']
        ],
      });

      return res.json({
        success: true,
        data: rows,
        total: count,
        page: safePage,
        limit: l,
        totalPages: Math.ceil(count / l),
      });
    } catch (error) {
      next(error);
    }
  };
}

// 3. Export instance
export const machineController = new MachineController();
