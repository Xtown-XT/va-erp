import EmployeeList from "../../modules/employee/employeeList.model.js";
import EmployeeAttendance from "../../modules/employee/employeeAttendance.model.js";
import Brand from "../../modules/brand/brand.model.js";
import Machine from "../../modules/machine/machine.model.js";
import Site from "../../modules/site/site.model.js";
import Compressor from "../../modules/compressor/compressor.model.js";
import DailyEntry from "../../modules/dailyEntry/dailyEntry.model.js";
import DailyEntryEmployee from "../../modules/dailyEntry/dailyEntryEmployee.model.js";
import Supplier from "../../modules/supplier/supplier.model.js";
import Spares from "../../modules/spares/spares.model.js";
import DrillingTools from "../../modules/drillingTools/drillingTools.model.js";
import Purchase from "../../modules/inventory/models/purchase.model.js";
import SiteStock from "../../modules/inventory/models/siteStock.model.js";
import Address from "../../modules/address/address.model.js";

// New Models
import DrillingToolItems from "../../modules/drillingTools/drillingToolItems.model.js";
import DrillingToolLog from "../../modules/drillingTools/drillingToolLog.model.js";
import PurchaseOrder from "../../modules/inventory/models/purchaseOrder.model.js";
import PurchaseOrderItem from "../../modules/inventory/models/purchaseOrderItem.model.js";
import ServiceHistory from "../../modules/service/models/serviceHistory.model.js";
import ServiceItem from "../../modules/service/models/serviceItem.model.js";

export const defineAssociations = () => {

  // ========== EMPLOYEE MODULE RELATIONSHIPS ==========
  EmployeeList.hasMany(EmployeeAttendance, {
    foreignKey: "employeeId",
    as: "attendances",
  });
  EmployeeAttendance.belongsTo(EmployeeList, {
    foreignKey: "employeeId",
    as: "employee",
  });

  // ========== MACHINE MODULE RELATIONSHIPS ==========
  Brand.hasMany(Machine, { foreignKey: "brandId", as: "machines" });
  Machine.belongsTo(Brand, { foreignKey: "brandId", as: "brand" });

  Site.hasMany(Machine, { foreignKey: "siteId", as: "machines" });
  Machine.belongsTo(Site, { foreignKey: "siteId", as: "site" });

  Compressor.hasMany(Machine, { foreignKey: "compressorId", as: "machines" });
  Machine.belongsTo(Compressor, {
    foreignKey: "compressorId",
    as: "compressor",
  });

  Machine.hasMany(DailyEntry, { foreignKey: "machineId", as: "dailyEntries", onDelete: 'CASCADE' });
  DailyEntry.belongsTo(Machine, { foreignKey: "machineId", as: "machine", onDelete: 'CASCADE' });

  // ========== DAILY ENTRY RELATIONSHIPS ==========
  Site.hasMany(DailyEntry, { foreignKey: "siteId", as: "dailyEntries" });
  DailyEntry.belongsTo(Site, { foreignKey: "siteId", as: "site" });

  // Primary employee relationship (one-to-many)
  EmployeeList.hasMany(DailyEntry, { foreignKey: "employeeId", as: "dailyEntriesAsPrimary" });
  DailyEntry.belongsTo(EmployeeList, { foreignKey: "employeeId", as: "primaryEmployee" });

  Compressor.hasMany(DailyEntry, { foreignKey: "compressorId", as: "dailyEntries" });
  DailyEntry.belongsTo(Compressor, { foreignKey: "compressorId", as: "compressor" });

  // Many-to-many employee relationships (additional employees)
  EmployeeList.belongsToMany(DailyEntry, {
    through: DailyEntryEmployee,
    foreignKey: "employeeId",
    otherKey: "dailyEntryId",
    as: "dailyEntries",
  });
  DailyEntry.belongsToMany(EmployeeList, {
    through: DailyEntryEmployee,
    foreignKey: "dailyEntryId",
    otherKey: "employeeId",
    as: "employees",
  });

  DailyEntry.hasMany(ServiceHistory, { foreignKey: "dailyEntryId", as: "services" });
  ServiceHistory.belongsTo(DailyEntry, { foreignKey: "dailyEntryId", as: "dailyEntry" });

  DailyEntry.hasMany(DrillingToolLog, { foreignKey: "dailyEntryId", as: "drillingLogs" });
  DrillingToolLog.belongsTo(DailyEntry, { foreignKey: "dailyEntryId", as: "dailyEntry" });

  // ========== EMPLOYEE ATTENDANCE RELATIONSHIPS ==========
  Site.hasMany(EmployeeAttendance, { foreignKey: "siteId", as: "attendances" });
  EmployeeAttendance.belongsTo(Site, { foreignKey: "siteId", as: "site" });

  Machine.hasMany(EmployeeAttendance, {
    foreignKey: "machineId",
    as: "attendances",
  });
  EmployeeAttendance.belongsTo(Machine, {
    foreignKey: "machineId",
    as: "machine",
  });

  // ========== INVENTORY RELATIONSHIPS ==========
  // Purchase (Simple / Legacy)
  Purchase.belongsTo(Spares, { foreignKey: "spareId", as: "spare" });
  Purchase.belongsTo(DrillingTools, { foreignKey: "drillingToolId", as: "drillingTool" });
  Purchase.belongsTo(Supplier, { foreignKey: "supplierId", as: "supplier" });

  Spares.hasMany(Purchase, { foreignKey: "spareId", as: "purchases" });
  DrillingTools.hasMany(Purchase, { foreignKey: "drillingToolId", as: "purchases" });
  Supplier.hasMany(Purchase, { foreignKey: "supplierId", as: "purchases" });

  // SiteStock
  SiteStock.belongsTo(Site, { foreignKey: "siteId", as: "site" });
  SiteStock.belongsTo(Spares, { foreignKey: "spareId", as: "spare" });
  SiteStock.belongsTo(DrillingTools, { foreignKey: "drillingToolId", as: "drillingTool" });

  Site.hasMany(SiteStock, { foreignKey: "siteId", as: "stocks" });
  Spares.hasMany(SiteStock, { foreignKey: "spareId", as: "siteStocks" });
  DrillingTools.hasMany(SiteStock, { foreignKey: "drillingToolId", as: "siteStocks" });

  // ========== NEW PO SYSTEM RELATIONSHIPS ==========
  // PurchaseOrder
  PurchaseOrder.belongsTo(Supplier, { foreignKey: "supplierId", as: "supplier" });
  Supplier.hasMany(PurchaseOrder, { foreignKey: "supplierId", as: "purchaseOrders" });

  PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: "purchaseOrderId", as: "items" });
  PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: "purchaseOrderId", as: "purchaseOrder" });

  // PurchaseOrderItem
  PurchaseOrderItem.belongsTo(Spares, { foreignKey: "spareId", as: "spare" });
  PurchaseOrderItem.belongsTo(DrillingTools, { foreignKey: "drillingToolId", as: "drillingTool" });

  // ========== DRILLING TOOL INSTANCES RELATIONSHIPS ==========
  DrillingToolItems.belongsTo(DrillingTools, { foreignKey: "drillingToolId", as: "catalogItem" });
  DrillingTools.hasMany(DrillingToolItems, { foreignKey: "drillingToolId", as: "instances" });

  DrillingToolItems.belongsTo(Site, { foreignKey: "siteId", as: "site" });
  Site.hasMany(DrillingToolItems, { foreignKey: "siteId", as: "drillingTools" });

  DrillingToolItems.belongsTo(Machine, { foreignKey: "fittedMachineId", as: "machine" });
  Machine.hasMany(DrillingToolItems, { foreignKey: "fittedMachineId", as: "fittedDrillingTools" });

  DrillingToolItems.belongsTo(Compressor, { foreignKey: "fittedCompressorId", as: "compressor" });
  Compressor.hasMany(DrillingToolItems, { foreignKey: "fittedCompressorId", as: "fittedDrillingTools" });

  // ========== SERVICE HISTORY RELATIONSHIPS ==========
  ServiceHistory.belongsTo(Machine, { foreignKey: "machineId", as: "machine" });
  Machine.hasMany(ServiceHistory, { foreignKey: "machineId", as: "serviceHistory" });

  ServiceHistory.belongsTo(Compressor, { foreignKey: "compressorId", as: "compressor" });
  Compressor.hasMany(ServiceHistory, { foreignKey: "compressorId", as: "serviceHistory" });

  ServiceHistory.belongsTo(Site, { foreignKey: "siteId", as: "site" });
  Site.hasMany(ServiceHistory, { foreignKey: "siteId", as: "serviceHistory" });

  ServiceHistory.hasMany(ServiceItem, { foreignKey: "serviceHistoryId", as: "items" });
  ServiceItem.belongsTo(ServiceHistory, { foreignKey: "serviceHistoryId", as: "serviceHistory" });

  // ServiceItem
  ServiceItem.belongsTo(Spares, { foreignKey: "spareId", as: "spare" });
  ServiceItem.belongsTo(DrillingToolItems, { foreignKey: "drillingToolItemId", as: "drillingToolItem" });

  // PurchaseOrder Address Associations
  PurchaseOrder.belongsTo(Address, { foreignKey: "addressId", as: "address" });
  PurchaseOrder.belongsTo(Address, { foreignKey: "shippingAddressId", as: "shippingAddress" });

  // ========== DRILLING TOOL LOGS RELATIONSHIPS ==========
  // Missing association causing EagerLoadingError
  DrillingToolLog.belongsTo(DrillingTools, { foreignKey: "drillingToolId", as: "drillingTool" });
  DrillingTools.hasMany(DrillingToolLog, { foreignKey: "drillingToolId", as: "logs" });
};
