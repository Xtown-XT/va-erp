import StockTransaction from "./stockTransaction.model.js";
import Item from "../item/item.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";

// Create CRUD service from model
const StockTransactionCrud = new BaseCrud(StockTransaction);

class StockTransactionCustomController extends BaseController {
  constructor(crud, modelName) {
    super(crud, modelName);
  }

  // Add manual stock entry
  addStock = async (req, res, next) => {
    try {
      const { itemId, quantity, nextServiceRPM, notes } = req.body;

      // 1. Validate item exists
      const item = await Item.findByPk(itemId);
      if (!item) {
        return res.status(404).json({ 
          success: false, 
          message: "Item not found" 
        });
      }

      // 2. Simply increment stock
      await item.update({
        stock: (item.stock || 0) + quantity
      });

      // Note: Fittable items should be created via Item Management page, not through stock transactions
      // Stock transactions only update the stock count for non-fittable items

      return res.json({
        success: true,
        message: `${quantity} ${item.itemName} added to stock`,
        data: {
          item
        }
      });
    } catch (error) {
      console.error("Error adding stock:", error);
      next(error);
    }
  };
}

export const StockTransactionController = new StockTransactionCustomController(
  StockTransactionCrud,
  "StockTransaction"
);


