import Site from "./site.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";

// 1. Create CRUD service from model
const SiteCrud = new BaseCrud(Site);

// 2. Plug it into BaseController
const BaseSiteController = new BaseController(SiteCrud, "Site");

// 3. Override getAll to sort by number prefix in siteName
export const SiteController = {
  ...BaseSiteController,
  
  getAll: async (req, res, next) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      
      // Get all sites (or paginated)
      const { limit: l, offset, page: safePage } = BaseCrud.paginate(page, limit);
      
      const { rows, count } = await Site.findAndCountAll({
        limit: l,
        offset,
        order: [["createdAt", "DESC"]],
      });
      
      // Sort by number prefix in siteName
      // Extract number from "1.erode" format and sort numerically
      const sortedRows = rows.sort((a, b) => {
        const getNumberPrefix = (siteName) => {
          if (!siteName) return Infinity; // Put items without prefix at the end
          const match = siteName.match(/^(\d+)\./);
          return match ? parseInt(match[1], 10) : Infinity;
        };
        
        const numA = getNumberPrefix(a.siteName);
        const numB = getNumberPrefix(b.siteName);
        
        // If both have numbers, sort by number
        if (numA !== Infinity && numB !== Infinity) {
          return numA - numB;
        }
        // If only one has a number, put it first
        if (numA !== Infinity) return -1;
        if (numB !== Infinity) return 1;
        // If neither has a number, sort alphabetically
        return (a.siteName || '').localeCompare(b.siteName || '');
      });
      
      return res.json({
        success: true,
        data: sortedRows,
        total: count,
        page: safePage,
        limit: l,
        totalPages: Math.ceil(count / l),
      });
    } catch (error) {
      next(error);
    }
  },
};
