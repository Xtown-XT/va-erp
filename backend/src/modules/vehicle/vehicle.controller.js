import Machine from "./vehicle.model.js";
// import ItemService from "../itemService/itemService.model.js";
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
      const username = req.user?.username || 'system';

      /*
      // Mark all fitted items for this machine as removed in ItemService
      await ItemService.update(
        {
          status: 'removed',
          removedDate: new Date().toISOString().split('T')[0],
          updatedBy: username
        },
        {
          where: {
            vehicleId: id,
            status: 'fitted'
          }
        }
      );
      */

      // Continue with normal soft delete - call service directly
      const userData = {
        deletedBy: username,
      };

      const item = await this.service.softDelete(id, userData);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${this.entityName} not found`,
        });
      }
      return res.json({
        success: true,
        message: `${this.entityName} soft deleted successfully`,
      });
    } catch (error) {
      next(error);
    }
  };

  // Override hardDelete to handle fitted items
  hardDelete = async (req, res, next) => {
    try {
      const { id } = req.params;
      const username = req.user?.username || 'system';

      /*
      // Mark all fitted items for this machine as removed in ItemService
      await ItemService.update(
        {
          status: 'removed',
          removedDate: new Date().toISOString().split('T')[0],
          updatedBy: username
        },
        {
          where: {
            vehicleId: id,
            status: 'fitted'
          }
        }
      );
      */

      // Continue with normal hard delete - call service directly
      const item = await this.service.hardDelete(id);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${this.entityName} not found`,
        });
      }
      return res.json({
        success: true,
        message: `${this.entityName} permanently deleted`,
      });
    } catch (error) {
      next(error);
    }
  };

  // Override getAll to sort by vehicleNumber using natural numeric sort
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const { limit: l, offset, page: safePage } = BaseCrud.paginate(page, limit);

      // Fetch all records (no limit/offset for sorting)
      const { rows: allRows, count } = await Machine.findAndCountAll();

      // Helper function to extract numeric part from vehicleNumber (e.g., "VA-1" -> 1, "VA-10" -> 10)
      const extractNumber = (vehicleNumber) => {
        if (!vehicleNumber) return 999999;
        const vehicleNumStr = String(vehicleNumber);
        // Extract number after hyphen (e.g., "VA-1" -> "1", "VA-10" -> "10")
        const match = vehicleNumStr.match(/-(\d+)$/);
        if (match) {
          return parseInt(match[1], 10);
        }
        // Fallback: extract all digits
        const digits = vehicleNumStr.replace(/\D/g, '');
        return digits ? parseInt(digits, 10) : 999999;
      };

      // Sort by numeric part, then by vehicleNumber as fallback
      // Convert to array and sort
      const rowsArray = Array.from(allRows);
      const sortedRows = rowsArray.sort((a, b) => {
        const numA = extractNumber(a.vehicleNumber);
        const numB = extractNumber(b.vehicleNumber);

        if (numA !== numB) {
          return numA - numB;
        }
        // If numbers are equal, sort alphabetically by vehicleNumber
        const vehicleNumA = String(a.vehicleNumber || '');
        const vehicleNumB = String(b.vehicleNumber || '');
        return vehicleNumA.localeCompare(vehicleNumB);
      });

      // Apply pagination to sorted array
      const paginatedRows = sortedRows.slice(offset, offset + l);

      return res.json({
        success: true,
        data: paginatedRows,
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
