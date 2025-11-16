import EmployeeList from "../../modules/employee/employeeList.model.js";
import EmployeeAttendance from "../../modules/employee/employeeAttendance.model.js";
import Brand from "../../modules/brand/brand.model.js";
import Machine from "../../modules/vehicle/vehicle.model.js";
import Service from "../../modules/service/service.model.js";
import Site from "../../modules/site/site.model.js";
import Item from "../../modules/item/item.model.js";
import ItemService from "../../modules/itemService/itemService.model.js";
import StockTransaction from "../../modules/stockTransaction/stockTransaction.model.js";
import Supplier from "../../modules/supplier/supplier.model.js";
import Po from "../../modules/po/po.model.js";
import PoItem from "../../modules/poItem/poItem.model.js";
import DailyEntry from "../../modules/dailyEntry/dailyEntry.model.js";
import DailyEntryEmployee from "../../modules/dailyEntry/dailyEntryEmployee.model.js";
import Compressor from "../../modules/compressor/compressor.model.js";
import Address from "../../modules/address/address.model.js";
import User from "../../modules/user/user.model.js";

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

  Machine.hasMany(DailyEntry, { foreignKey: "vehicleId", as: "dailyEntries" }); // DB column kept as vehicleId
  DailyEntry.belongsTo(Machine, { foreignKey: "vehicleId", as: "machine" }); // Changed alias to machine

  Machine.hasMany(Service, { foreignKey: "vehicleId", as: "services" }); // DB column kept as vehicleId
  Service.belongsTo(Machine, { foreignKey: "vehicleId", as: "machine" }); // Changed alias to machine

  Compressor.hasMany(Service, { foreignKey: "compressorId", as: "services" });
  Service.belongsTo(Compressor, {
    foreignKey: "compressorId",
    as: "compressor",
  });

  // ========== DAILY ENTRY RELATIONSHIPS ==========
  Site.hasMany(DailyEntry, { foreignKey: "siteId", as: "dailyEntries" });
  DailyEntry.belongsTo(Site, { foreignKey: "siteId", as: "site" });

  // Primary employee relationship (one-to-many)
  EmployeeList.hasMany(DailyEntry, { foreignKey: "employeeId", as: "dailyEntriesAsPrimary" });
  DailyEntry.belongsTo(EmployeeList, { foreignKey: "employeeId", as: "primaryEmployee" });

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

  // ========== PO / SUPPLIER / ITEM RELATIONSHIPS ==========
  Supplier.hasMany(Po, { foreignKey: "supplierId", as: "pos" });
  Po.belongsTo(Supplier, { foreignKey: "supplierId", as: "supplier" });

  // Address relationships
  Address.hasMany(Po, { foreignKey: "addressId", as: "pos" });
  Po.belongsTo(Address, { foreignKey: "addressId", as: "address" });

  // Shipping address relationship
  Address.hasMany(Po, { foreignKey: "shippingAddressId", as: "shippingPos" });
  Po.belongsTo(Address, { foreignKey: "shippingAddressId", as: "shippingAddress" });

  Po.belongsToMany(Item, {
    through: PoItem,
    foreignKey: "poId",
    otherKey: "itemId",
    as: "items",
  });
  Item.belongsToMany(Po, {
    through: PoItem,
    foreignKey: "itemId",
    otherKey: "poId",
    as: "pos",
  });

  Po.hasMany(PoItem, { foreignKey: "poId", as: "poItems" });
  PoItem.belongsTo(Po, { foreignKey: "poId", as: "po" });

  Item.hasMany(PoItem, { foreignKey: "itemId", as: "poItems" });
  PoItem.belongsTo(Item, { foreignKey: "itemId", as: "item" });

  // ========== STOCK TRANSACTION RELATIONSHIPS ==========
  Item.hasMany(StockTransaction, { foreignKey: "itemId", as: "stockTransactions" });
  StockTransaction.belongsTo(Item, { foreignKey: "itemId", as: "item" });


  // ========== EMPLOYEE ATTENDANCE RELATIONSHIPS ==========
  Site.hasMany(EmployeeAttendance, { foreignKey: "siteId", as: "attendances" });
  EmployeeAttendance.belongsTo(Site, { foreignKey: "siteId", as: "site" });

  Machine.hasMany(EmployeeAttendance, {
    foreignKey: "vehicleId", // DB column kept
    as: "attendances",
  });
  EmployeeAttendance.belongsTo(Machine, {
    foreignKey: "vehicleId", // DB column kept
    as: "machine", // Changed alias to machine
  });


  // ========== ITEM SERVICE RELATIONSHIPS ==========
  // ItemService tracks item fitting/usage
  Item.hasMany(ItemService, { foreignKey: "itemId", as: "itemServices" });
  ItemService.belongsTo(Item, { foreignKey: "itemId", as: "item" });

  DailyEntry.hasMany(ItemService, { foreignKey: "dailyEntryId", as: "itemServices" });
  ItemService.belongsTo(DailyEntry, { foreignKey: "dailyEntryId", as: "dailyEntry" });

  Machine.hasMany(ItemService, { foreignKey: "vehicleId", as: "itemServices" });
  ItemService.belongsTo(Machine, { foreignKey: "vehicleId", as: "machine" });

  Compressor.hasMany(ItemService, { foreignKey: "compressorId", as: "itemServices" });
  ItemService.belongsTo(Compressor, { foreignKey: "compressorId", as: "compressor" });

  // Service relationships with Item (deprecated, now using ItemService)
  Item.hasMany(Service, { foreignKey: "itemId", as: "services" });
  Service.belongsTo(Item, { foreignKey: "itemId", as: "item" });

  // ========== USER RELATIONSHIPS ==========
  // User model relationships (if needed for createdBy/updatedBy tracking)
  // Note: These are typically handled by commonFields, but can be explicit if needed
};
