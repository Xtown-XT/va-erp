import Machine from "../vehicle/vehicle.model.js";
import Compressor from "../compressor/compressor.model.js";
import Item from "../item/item.model.js";
import { Op } from "sequelize";

class ServiceAlertsController {
  // Get all service alerts for vehicles, compressors, and fittable items
  getAllServiceAlerts = async (req, res, next) => {
    try {
      const alerts = [];

      // Get all active machines
      const machines = await Machine.findAll({
        where: {
          deletedAt: null
        },
        attributes: ["id", "vehicleNumber", "vehicleType", "vehicleRPM", "nextServiceRPM"] // DB columns kept
      });

      for (const machine of machines) {
        const currentRPM = machine.vehicleRPM || 0; // DB column kept
        const nextServiceRPM = machine.nextServiceRPM;
        
        if (nextServiceRPM && nextServiceRPM > 0) {
          const remaining = nextServiceRPM - currentRPM;
          const overdue = currentRPM - nextServiceRPM;
          
          let priority, message, isAlert;
          
          // Check if overdue first
          if (currentRPM >= nextServiceRPM) {
            // Service is overdue
            if (overdue > 100) {
              priority = "high";
              message = `Machine ${machine.vehicleNumber} service OVERDUE by ${Math.round(overdue)} RPM`;
              isAlert = true;
            } else if (overdue > 50) {
              priority = "medium";
              message = `Machine ${machine.vehicleNumber} service OVERDUE by ${Math.round(overdue)} RPM`;
              isAlert = true;
            } else {
              priority = "medium";
              message = `Machine ${machine.vehicleNumber} service OVERDUE by ${Math.round(overdue)} RPM`;
              isAlert = true;
            }
          } else if (remaining <= 50) {
            // Service due soon
            priority = "low";
            message = `Machine ${machine.vehicleNumber} service due soon (${Math.round(remaining)} RPM remaining)`;
            isAlert = true;
          } else {
            // Service is good
            priority = "good";
            message = `Machine ${machine.vehicleNumber} - Service in ${Math.round(remaining)} RPM`;
            isAlert = false;
          }
          
          alerts.push({
            type: "machine", // Changed from "vehicle"
            id: machine.id,
            name: `${machine.vehicleNumber} (${machine.vehicleType})`,
            currentRPM,
            nextServiceRPM,
            overdue: Math.max(0, overdue),
            remaining: Math.max(0, remaining),
            priority,
            message,
            isAlert
          });
        } else {
          // No service schedule set
          alerts.push({
            type: "machine", // Changed from "vehicle"
            id: machine.id,
            name: `${machine.vehicleNumber} (${machine.vehicleType})`,
            currentRPM,
            nextServiceRPM: 0,
            overdue: 0,
            remaining: 0,
            priority: "info",
            message: `Machine ${machine.vehicleNumber} - No service schedule set`,
            isAlert: false
          });
        }
      }

      // Get all active compressors
      const compressors = await Compressor.findAll({
        where: {
          status: "active",
          deletedAt: null
        },
        attributes: ["id", "compressorName", "compressorRPM", "nextServiceRPM"]
      });

      for (const compressor of compressors) {
        const currentRPM = compressor.compressorRPM || 0;
        const nextServiceRPM = compressor.nextServiceRPM;
        
        if (nextServiceRPM && nextServiceRPM > 0) {
          const remaining = nextServiceRPM - currentRPM;
          const overdue = currentRPM - nextServiceRPM;
          
          let priority, message, isAlert;
          
          // Check if overdue first
          if (currentRPM >= nextServiceRPM) {
            // Service is overdue
            if (overdue > 100) {
              priority = "high";
              message = `Compressor ${compressor.compressorName} service OVERDUE by ${Math.round(overdue)} RPM`;
              isAlert = true;
            } else if (overdue > 50) {
              priority = "medium";
              message = `Compressor ${compressor.compressorName} service OVERDUE by ${Math.round(overdue)} RPM`;
              isAlert = true;
            } else {
              priority = "medium";
              message = `Compressor ${compressor.compressorName} service OVERDUE by ${Math.round(overdue)} RPM`;
              isAlert = true;
            }
          } else if (remaining <= 50) {
            // Service due soon
            priority = "low";
            message = `Compressor ${compressor.compressorName} service due soon (${Math.round(remaining)} RPM remaining)`;
            isAlert = true;
          } else {
            // Service is good
            priority = "good";
            message = `Compressor ${compressor.compressorName} - Service in ${Math.round(remaining)} RPM`;
            isAlert = false;
          }
          
          alerts.push({
            type: "compressor",
            id: compressor.id,
            name: `${compressor.compressorName}`,
            currentRPM,
            nextServiceRPM,
            overdue: Math.max(0, overdue),
            remaining: Math.max(0, remaining),
            priority,
            message,
            isAlert
          });
        } else {
          // No service schedule set
          alerts.push({
            type: "compressor",
            id: compressor.id,
            name: `${compressor.compressorName}`,
            currentRPM,
            nextServiceRPM: 0,
            overdue: 0,
            remaining: 0,
            priority: "info",
            message: `Compressor ${compressor.compressorName} - No service schedule set`,
            isAlert: false
          });
        }
      }

      // Get all fittable items (fitted and in_stock)
      const items = await Item.findAll({
        where: {
          canBeFitted: true,
          [Op.or]: [
            { status: "fitted" },
            { status: "in_stock" }
          ],
          deletedAt: null
        },
        include: [
          {
            model: Machine,
            as: "fittedToMachine", // Changed alias
            attributes: ["id", "vehicleNumber", "vehicleType"] // DB columns kept
          }
        ],
        attributes: ["id", "modelName", "itemName", "partNumber", "currentRPM", "nextServiceRPM", "fittedToVehicleId", "status"] // DB column kept
      });

      for (const item of items) {
        const currentRPM = item.currentRPM || 0;
        const nextServiceRPM = item.nextServiceRPM;
        
        if (nextServiceRPM && nextServiceRPM > 0) {
          const remaining = nextServiceRPM - currentRPM;
          const overdue = currentRPM - nextServiceRPM;
          
          let priority, message, isAlert;
          
          // Check if overdue first
          if (currentRPM >= nextServiceRPM) {
            // Service is overdue
            if (overdue > 100) {
              priority = "high";
              message = `Item ${item.itemName} (${item.modelName}) service OVERDUE by ${Math.round(overdue)} RPM`;
              isAlert = true;
            } else if (overdue > 50) {
              priority = "medium";
              message = `Item ${item.itemName} (${item.modelName}) service OVERDUE by ${Math.round(overdue)} RPM`;
              isAlert = true;
            } else {
              priority = "medium";
              message = `Item ${item.itemName} (${item.modelName}) service OVERDUE by ${Math.round(overdue)} RPM`;
              isAlert = true;
            }
          } else if (remaining <= 50) {
            // Service due soon
            priority = "low";
            message = `Item ${item.itemName} (${item.modelName}) service due soon (${Math.round(remaining)} RPM remaining)`;
            isAlert = true;
          } else {
            // Service is good
            priority = "good";
            message = `Item ${item.itemName} (${item.modelName}) - Service in ${Math.round(remaining)} RPM`;
            isAlert = false;
          }
          
          alerts.push({
            type: "item",
            id: item.id,
            itemId: item.id,
            name: `${item.itemName} (${item.modelName})`,
            machineName: item.fittedToMachine?.vehicleNumber || "Not fitted", // Changed alias
            currentRPM,
            nextServiceRPM,
            overdue: Math.max(0, overdue),
            remaining: Math.max(0, remaining),
            priority,
            message,
            isAlert
          });
        } else {
          // No service schedule set
          alerts.push({
            type: "item",
            id: item.id,
            itemId: item.id,
            name: `${item.itemName} (${item.modelName})`,
            machineName: item.fittedToMachine?.vehicleNumber || "Not fitted", // Changed alias
            currentRPM,
            nextServiceRPM: 0,
            overdue: 0,
            remaining: 0,
            priority: "info",
            message: `Item ${item.itemName} (${item.modelName}) - No service schedule set`,
            isAlert: false
          });
        }
      }

      // Sort by priority (high > medium > low) and then by overdue amount
      alerts.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return (b.overdue || 0) - (a.overdue || 0);
      });

      return res.json({
        success: true,
        data: alerts,
        count: alerts.length,
        summary: {
          total: alerts.length,
          high: alerts.filter(a => a.priority === "high").length,
          medium: alerts.filter(a => a.priority === "medium").length,
          low: alerts.filter(a => a.priority === "low").length,
          byType: {
            machines: alerts.filter(a => a.type === "machine").length, // Changed from "vehicle"
            compressors: alerts.filter(a => a.type === "compressor").length,
            items: alerts.filter(a => a.type === "item").length,
          }
        }
      });
    } catch (error) {
      console.error("Error fetching service alerts:", error);
      next(error);
    }
  };

  // Get only urgent service alerts for notifications (RPM difference < 50)
  getUrgentAlerts = async (req, res, next) => {
    try {
      const alerts = [];

      // Get machines that need urgent service
      const machines = await Machine.findAll({
        where: {
          status: "active",
          deletedAt: null
        },
        attributes: ["id", "vehicleNumber", "vehicleType", "vehicleRPM", "nextServiceRPM"] // DB columns kept
      });

      for (const machine of machines) {
        const currentRPM = machine.vehicleRPM || 0; // DB column kept
        const nextServiceRPM = machine.nextServiceRPM;
        
        if (nextServiceRPM && nextServiceRPM > 0) {
          const remaining = nextServiceRPM - currentRPM;
          const overdue = currentRPM - nextServiceRPM;
          
          // Only include if service is due, overdue, or within 50 RPM
          if (overdue > 0 || remaining <= 50) {
            let priority;
            if (overdue > 100) {
              priority = "high";
            } else if (overdue > 50) {
              priority = "medium";
            } else {
              priority = "low";
            }
            
            alerts.push({
              type: "machine", // Changed from "vehicle"
              id: machine.id,
              name: `${machine.vehicleNumber} (${machine.vehicleType})`,
              currentRPM,
              nextServiceRPM,
              overdue: Math.max(0, overdue),
              remaining: Math.max(0, remaining),
              priority,
              message: `Machine ${machine.vehicleNumber} service ${overdue > 0 ? 'OVERDUE' : 'DUE NOW'}`,
            });
          }
        }
      }

      // Get compressors that need urgent service
      const compressors = await Compressor.findAll({
        where: {
          status: "active",
          deletedAt: null
        },
        attributes: ["id", "compressorName", "compressorRPM", "nextServiceRPM"]
      });

      for (const compressor of compressors) {
        const currentRPM = compressor.compressorRPM || 0;
        const nextServiceRPM = compressor.nextServiceRPM;
        
        if (nextServiceRPM && nextServiceRPM > 0) {
          const remaining = nextServiceRPM - currentRPM;
          const overdue = currentRPM - nextServiceRPM;
          
          // Only include if service is due, overdue, or within 50 RPM
          if (overdue > 0 || remaining <= 50) {
            let priority;
            if (overdue > 100) {
              priority = "high";
            } else if (overdue > 50) {
              priority = "medium";
            } else {
              priority = "low";
            }
            
            alerts.push({
              type: "compressor",
              id: compressor.id,
              name: `${compressor.compressorName}`,
              currentRPM,
              nextServiceRPM,
              overdue: Math.max(0, overdue),
              remaining: Math.max(0, remaining),
              priority,
              message: `Compressor ${compressor.compressorName} service ${overdue > 0 ? 'OVERDUE' : 'DUE NOW'}`,
            });
          }
        }
      }

      // Get fittable items that need urgent service
      const items = await Item.findAll({
        where: {
          canBeFitted: true,
          [Op.or]: [
            { status: "fitted" },
            { status: "in_stock" }
          ],
          nextServiceRPM: { [Op.ne]: null },
          deletedAt: null
        },
        include: [
          {
            model: Machine,
            as: "fittedToMachine", // Changed alias
            attributes: ["id", "vehicleNumber", "vehicleType"] // DB columns kept
          }
        ],
        attributes: ["id", "modelName", "itemName", "partNumber", "currentRPM", "nextServiceRPM", "fittedToVehicleId", "status"] // DB column kept
      });

      for (const item of items) {
        const currentRPM = item.currentRPM || 0;
        const nextServiceRPM = item.nextServiceRPM;
        
        if (nextServiceRPM && nextServiceRPM > 0) {
          const remaining = nextServiceRPM - currentRPM;
          const overdue = currentRPM - nextServiceRPM;
          
          // Only include if service is due, overdue, or within 50 RPM
          if (overdue > 0 || remaining <= 50) {
            let priority;
            if (overdue > 100) {
              priority = "high";
            } else if (overdue > 50) {
              priority = "medium";
            } else {
              priority = "low";
            }
            
            alerts.push({
              type: "item",
              id: item.id,
              itemId: item.id,
              name: `${item.itemName} (${item.modelName})`,
              machineName: item.fittedToMachine?.vehicleNumber || "Not fitted", // Changed alias
              currentRPM,
              nextServiceRPM,
              overdue: Math.max(0, overdue),
              remaining: Math.max(0, remaining),
              priority,
              message: `Item ${item.itemName} (${item.modelName}) service ${overdue > 0 ? 'OVERDUE' : 'DUE NOW'}`,
            });
          }
        }
      }

      // Sort by priority (high > medium > low) and then by overdue amount
      alerts.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return (b.overdue || 0) - (a.overdue || 0);
      });

      return res.json({
        success: true,
        data: alerts,
        count: alerts.length,
        summary: {
          total: alerts.length,
          high: alerts.filter(a => a.priority === "high").length,
          medium: alerts.filter(a => a.priority === "medium").length,
          low: alerts.filter(a => a.priority === "low").length,
          overdue: alerts.filter(a => a.overdue > 0).length,
          dueSoon: alerts.filter(a => a.remaining && a.remaining <= 50).length,
        }
      });
    } catch (error) {
      console.error("Urgent alerts error:", error);
      next(error);
    }
  };
}

export default new ServiceAlertsController();