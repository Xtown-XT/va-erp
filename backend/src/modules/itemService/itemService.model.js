import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const ItemService = sequelize.define(
  "ItemService",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    itemId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "item",
        key: "id",
      },
    },
    dailyEntryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "dailyEntry",
        key: "id",
      },
    },
    vehicleId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "vehicle",
        key: "id",
      },
    },
    compressorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "compressor",
        key: "id",
      },
    },
    serviceType: {
      type: DataTypes.ENUM("machine", "compressor", "drilling_tool"),
      allowNull: false,
    },
    // Fitting details
    fittedDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fittedRPM: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    fittedMeter: {
      type: DataTypes.DOUBLE,
      allowNull: true, // For drilling tools
    },
    removedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    removedRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    removedMeter: {
      type: DataTypes.DOUBLE,
      allowNull: true, // For drilling tools
    },
    // Calculated fields
    totalRPMRun: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    totalMeterRun: {
      type: DataTypes.DOUBLE,
      allowNull: true, // For drilling tools
    },
    // Quantity used (for consumable items)
    quantity: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 1,
    },
    // Status
    status: {
      type: DataTypes.ENUM("fitted", "removed"),
      allowNull: false,
      defaultValue: "fitted",
    },
    ...commonFields,
  },
  {
    tableName: "itemService",
    timestamps: true,
    paranoid: true,
  }
);

export default ItemService;

