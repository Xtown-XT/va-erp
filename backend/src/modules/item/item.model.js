import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const Item = sequelize.define(
  "Item",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    itemName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    partNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      // Remove unique constraint - same partNumber can have multiple rows for fittable items
    },
    groupName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    units: {
      type: DataTypes.ENUM("kg", "ltr", "mtr", "nos", "set", "unit", "kit"),
      allowNull: false,
    },
    purchaseRate: {
      type: DataTypes.DECIMAL(12, 2), // precise pricing
      allowNull: false,
    },
    gst: {
      type: DataTypes.DECIMAL(5, 2), // e.g., 18.00
      allowNull: false,
      defaultValue: 0.0,
    },
    // Track if item can be fitted to machines
    canBeFitted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Simple stock quantity tracking (for non-fittable items only)
    stock: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },
    // Fields for fittable items (one row per physical unit)
    modelName: {
      type: DataTypes.STRING,
      allowNull: true, // Only required when canBeFitted=true
      unique: true,
    },
    // Current RPM reading (cumulative) for fittable items
    currentRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },
    // Next service RPM for this unit
    nextServiceRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    // Current status of the unit (for fittable items)
    status: {
      type: DataTypes.ENUM("in_stock", "fitted", "removed"),
      allowNull: true, // Only for fittable items
      defaultValue: "in_stock",
    },
    // Currently fitted to which machine/vehicle
    fittedToVehicleId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "vehicle",
        key: "id",
      },
    },
    // When it was fitted
    fittedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    // When it was removed
    removedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    // Last service date
    lastServiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    ...commonFields,
  },
  {
    tableName: "item",
    timestamps: true,
    paranoid: true,
  }
);

export default Item;
