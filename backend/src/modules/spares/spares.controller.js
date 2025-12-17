import Spares from "./spares.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";

const SparesCrud = new BaseCrud(Spares);

// Custom controller to add search fields
class SparesControllerClass extends BaseController {
    constructor(service, entityName) {
        super(service, entityName);
    }

    // Override getAll to add search fields
    getAll = async (req, res, next) => {
        try {
            const { page = 1, limit = 10, search } = req.query;

            // Define searchable fields for spares
            const searchFields = ['name', 'partNumber'];

            const items = await this.service.getAll(page, limit, {
                search,
                searchFields
            });

            return res.json({ success: true, ...items });
        } catch (error) {
            next(error);
        }
    };
}

export const SparesController = new SparesControllerClass(SparesCrud, "Spares");
