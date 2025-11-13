import Machine from "./vehicle.model.js";
import Item from "../item/item.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";

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
}

// 3. Export instance
export const machineController = new MachineController();
