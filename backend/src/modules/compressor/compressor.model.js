import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const Compressor = sequelize.define(
  "Compressor",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    compressorName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    // Additional compressor details
    serialNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    purchaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    compressorRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: null,
    },
    lastServiceRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
      comment: "Last RPM when generic service was done",
    },
    lastEngineServiceRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
      comment: "Last RPM when Engine service was done",
    },
    serviceCycleRpm: {
      type: DataTypes.INTEGER,
      defaultValue: 250,
      comment: "Compressor service interval",
    },
    engineServiceCycleRpm: {
      type: DataTypes.INTEGER,
      defaultValue: 300,
      comment: "Engine service interval for compressor",
    },
    ...commonFields,
  },
  {
    tableName: "compressor",
    timestamps: true,
    paranoid: true,
  }
);

export default Compressor;
