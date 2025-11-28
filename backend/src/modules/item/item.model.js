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
      // Unique for drilling tools, can be same for regular items
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
    // Item type: machine name, compressor name, or "Drilling Tools"
    itemType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Simple stock quantity tracking (deprecated in favor of balance)
    stock: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },
    // Monthly inventory tracking
    openingStock: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    inward: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    outward: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    balance: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    currentMonth: {
      type: DataTypes.STRING, // Format: "YYYY-MM"
      allowNull: false,
    },
    // Model name for drilling tools (unique identifier)
    modelName: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    // Individual drilling tool lifetime tracking
    currentRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },
    currentMeter: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
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
