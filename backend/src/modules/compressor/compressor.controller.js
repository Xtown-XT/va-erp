import Compressor from "./compressor.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";
import { Sequelize } from "sequelize";

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

      // Extract numeric part from serialNumber (e.g., "VA-19" -> 19, "VA-40" -> 40)
      // For MySQL: Get part after hyphen and cast to integer, fallback to 999999 if no number found
      const numericSort = Sequelize.literal(`
        CAST(
          CASE 
            WHEN SUBSTRING_INDEX(serialNumber, '-', -1) REGEXP '^[0-9]+$'
            THEN CAST(SUBSTRING_INDEX(serialNumber, '-', -1) AS UNSIGNED)
            ELSE 999999
          END AS UNSIGNED
        )
      `);

      const { rows, count } = await Compressor.findAndCountAll({
        limit: l,
        offset,
        order: [
          [numericSort, 'ASC'],
          ['serialNumber', 'ASC']
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
export const CompressorController = new CompressorCustomController();
