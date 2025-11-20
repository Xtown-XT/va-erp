import Compressor from "./compressor.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";

// 1. Create CRUD service from model
const CompressorCrud = new BaseCrud(Compressor);

// 2. Extend BaseController to add natural sorting by serialNumber
class CompressorCustomController extends BaseController {
  constructor() {
    super(CompressorCrud, "Compressor");
  }

  // Override getAll to sort by serialNumber using natural numeric sort
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const { limit: l, offset, page: safePage } = BaseCrud.paginate(page, limit);

      // Fetch all records (no limit/offset for sorting)
      const { rows: allRows, count } = await Compressor.findAndCountAll();

      // Helper function to extract numeric part from serialNumber (e.g., "VA-19" -> 19, "VA-40" -> 40)
      const extractNumber = (serialNumber) => {
        if (!serialNumber) return 999999;
        const serialNumStr = String(serialNumber);
        // Extract number after hyphen (e.g., "VA-19" -> "19", "VA-40" -> "40")
        const match = serialNumStr.match(/-(\d+)$/);
        if (match) {
          return parseInt(match[1], 10);
        }
        // Fallback: extract all digits
        const digits = serialNumStr.replace(/\D/g, '');
        return digits ? parseInt(digits, 10) : 999999;
      };

      // Sort by numeric part, then by serialNumber as fallback
      // Convert to array and sort
      const rowsArray = Array.from(allRows);
      const sortedRows = rowsArray.sort((a, b) => {
        const numA = extractNumber(a.serialNumber);
        const numB = extractNumber(b.serialNumber);
        
        if (numA !== numB) {
          return numA - numB;
        }
        // If numbers are equal, sort alphabetically by serialNumber
        const serialNumA = String(a.serialNumber || '');
        const serialNumB = String(b.serialNumber || '');
        return serialNumA.localeCompare(serialNumB);
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
export const CompressorController = new CompressorCustomController();
