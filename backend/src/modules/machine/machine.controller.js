import Machine from "./machine.model.js";
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

    // Override getAll to sort by machineNumber using natural numeric sort
    getAll = async (req, res, next) => {
        try {
            const { page = 1, limit = 10 } = req.query;
            const { limit: l, offset, page: safePage } = BaseCrud.paginate(page, limit);

            // Fetch all records (no limit/offset for sorting)
            const { rows: allRows, count } = await Machine.findAndCountAll();

            // Helper function to extract numeric part from machineNumber (e.g., "VA-1" -> 1, "VA-10" -> 10)
            const extractNumber = (machineNumber) => {
                if (!machineNumber) return 999999;
                const machineNumStr = String(machineNumber);
                // Extract number after hyphen (e.g., "VA-1" -> "1", "VA-10" -> "10")
                const match = machineNumStr.match(/-(\d+)$/);
                if (match) {
                    return parseInt(match[1], 10);
                }
                // Fallback: extract all digits
                const digits = machineNumStr.replace(/\D/g, '');
                return digits ? parseInt(digits, 10) : 999999;
            };

            // Sort by numeric part, then by machineNumber as fallback
            // Convert to array and sort
            const rowsArray = Array.from(allRows);
            const sortedRows = rowsArray.sort((a, b) => {
                const numA = extractNumber(a.machineNumber);
                const numB = extractNumber(b.machineNumber);

                if (numA !== numB) {
                    return numA - numB;
                }
                // If numbers are equal, sort alphabetically by machineNumber
                const machineNumA = String(a.machineNumber || '');
                const machineNumB = String(b.machineNumber || '');
                return machineNumA.localeCompare(machineNumB);
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
