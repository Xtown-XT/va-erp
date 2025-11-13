import Service from "./service.model.js";
import Machine from "../vehicle/vehicle.model.js";
import Compressor from "../compressor/compressor.model.js";
import Item from "../item/item.model.js";
import { BaseCrud } from "../../shared/utils/baseCrud.js";
import { BaseController } from "../../shared/utils/baseController.js";

// 1. Create CRUD service from model
const ServiceCrud = new BaseCrud(Service);

// 2. Extend controller to allow filtered history queries
class ServiceCustomController extends BaseController {
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, vehicleId, machineId, compressorId, itemId, serviceType } = req.query;
      const where = {};
      // Support both vehicleId (legacy) and machineId (new)
      const effectiveMachineId = machineId || vehicleId;
      if (effectiveMachineId) where.vehicleId = effectiveMachineId; // DB column kept
      if (compressorId) where.compressorId = compressorId;
      if (itemId) where.itemId = itemId;
      if (serviceType) where.serviceType = serviceType;

      // Simplified query for debugging
      const items = await this.service.getAll(page, limit, {
        where,
        // Temporarily remove complex includes to test basic functionality
      });
      return res.json({ success: true, ...items });
    } catch (error) {
      console.error("Service getAll error:", error);
      next(error);
    }
  };

  // Get service history with detailed information
  getServiceHistory = async (req, res, next) => {
    try {
      const { page = 1, limit = 50, serviceType, startDate, endDate } = req.query;
      const where = {};
      
      if (serviceType) where.serviceType = serviceType;
      if (startDate && endDate) {
        where.serviceDate = {
          [require('sequelize').Op.between]: [startDate, endDate]
        };
      }

      const { count, rows } = await Service.findAndCountAll({
        where,
        include: [
          {
            model: Machine,
            as: "machine", // Changed alias
            attributes: ["id", "vehicleNumber", "vehicleType", "vehicleRPM"], // DB columns kept
            required: false
          },
          {
            model: Compressor,
            as: "compressor", 
            attributes: ["id", "compressorName", "compressorRPM"],
            required: false
          },
          {
            model: Item,
            as: "item",
            attributes: ["id", "itemName", "partNumber", "modelName", "currentRPM", "nextServiceRPM", "status"],
            include: [
              {
                model: Machine,
                as: "fittedToMachine", // Changed alias
                attributes: ["id", "vehicleNumber", "vehicleType"], // DB columns kept
                required: false
              }
            ],
            required: false
          }
        ],
        order: [["serviceDate", "DESC"], ["createdAt", "DESC"]],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      // Transform the data for better frontend display
      const transformedRows = rows.map(service => {
        let itemDetails = null;
        let serviceName = "";
        let currentRPM = 0;

        if (service.serviceType === "machine" && service.machine) {
          serviceName = `${service.machine.vehicleNumber} (${service.machine.vehicleType})`;
          currentRPM = service.machine.vehicleRPM || 0;
        } else if (service.serviceType === "compressor" && service.compressor) {
          serviceName = `${service.compressor.compressorName}`;
          currentRPM = service.compressor.compressorRPM || 0;
        } else if (service.serviceType === "item" && service.item) {
          serviceName = `${service.item.itemName} (${service.item.modelName || service.item.partNumber})`;
          currentRPM = service.item.currentRPM || 0;
          itemDetails = {
            itemName: service.item.itemName,
            partNumber: service.item.partNumber,
            modelName: service.item.modelName,
            fittedToVehicle: service.item.fittedToMachine?.vehicleNumber || "Not fitted"
          };
        }

        return {
          id: service.id,
          serviceType: service.serviceType,
          serviceName: service.serviceName || null,
          serviceNameDisplay: serviceName,
          serviceRPM: service.serviceRPM,
          currentRPM,
          serviceDate: service.serviceDate,
          itemDetails,
          createdAt: service.createdAt,
          createdBy: service.createdBy
        };
      });

      return res.json({
        success: true,
        data: transformedRows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error("Service history error:", error);
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const service = await Service.findByPk(req.params.id, {
        include: [
          { model: Machine, as: "machine", attributes: ["id", "vehicleNumber", "vehicleType"] }, // Changed alias
          { model: Compressor, as: "compressor", attributes: ["id", "compressorName"] },
          { 
            model: Item, 
            as: "item", 
            attributes: ["id", "modelName", "currentRPM", "itemName", "partNumber"],
            include: [
              {
                model: Machine,
                as: "fittedToMachine",
                attributes: ["id", "vehicleNumber", "vehicleType"],
                required: false
              }
            ]
          }
        ]
      });
      if (!service) return res.status(404).json({ success: false, message: "Service not found" });
      return res.json({ success: true, data: service });
    } catch (error) {
      next(error);
    }
  };
}

export const ServiceController = new ServiceCustomController(ServiceCrud, "Service");
