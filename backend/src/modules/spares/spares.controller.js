import Spares from "./spares.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";

const SparesCrud = new BaseCrud(Spares);

export const SparesController = new BaseController(SparesCrud, "Spares");
