import Brand from "./brand.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";
import { Op } from "sequelize";

// 1. Create CRUD service from model
const BrandCrud = new BaseCrud(Brand);

// 2. Plug it into BaseController
const BaseBrandController = new BaseController(BrandCrud, "Brand");

// 3. Override getAll to add filtering support
export const BrandController = {
  ...BaseBrandController,
  
  getAll: async (req, res, next) => {
    try {
      const { page = 1, limit = 10, search, brandStatus } = req.query;
      
      // Build where clause for filtering
      const where = {};
      if (search) {
        where.brandName = { [Op.iLike]: `%${search}%` };
      }
      if (brandStatus) {
        where.brandStatus = brandStatus;
      }
      
      // Get paginated and filtered brands
      const items = await BrandCrud.getAll(page, limit, {
        where,
        order: [["createdAt", "DESC"]],
      });
      
      return res.json({ success: true, ...items });
    } catch (error) {
      next(error);
    }
  },
};
