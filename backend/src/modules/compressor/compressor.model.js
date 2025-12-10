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
    nextServiceRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    nextEngineServiceRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
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
    hooks: {
      beforeCreate: (compressor) => {
        // Init nextServiceRPM
        if (compressor.compressorRPM !== undefined && compressor.serviceCycleRpm && !compressor.nextServiceRPM) {
          const current = Number(compressor.compressorRPM) || 0;
          const cycle = Number(compressor.serviceCycleRpm);
          compressor.nextServiceRPM = Math.ceil((current + 1) / cycle) * cycle;
        }
        // Init nextEngineServiceRPM
        if (compressor.compressorRPM !== undefined && compressor.engineServiceCycleRpm && !compressor.nextEngineServiceRPM) {
          const current = Number(compressor.compressorRPM) || 0;
          const cycle = Number(compressor.engineServiceCycleRpm);
          compressor.nextEngineServiceRPM = Math.ceil((current + 1) / cycle) * cycle;
        }
      },
      beforeUpdate: (compressor) => {
        // Re-calc if Service Cycle changes
        if (compressor.changed('serviceCycleRpm')) {
          const current = Number(compressor.compressorRPM) || 0;
          const cycle = Number(compressor.serviceCycleRpm);
          compressor.nextServiceRPM = Math.ceil((current + 1) / cycle) * cycle;
        }
        // Re-calc if Engine Cycle changes
        if (compressor.changed('engineServiceCycleRpm')) {
          const current = Number(compressor.compressorRPM) || 0;
          const cycle = Number(compressor.engineServiceCycleRpm);
          compressor.nextEngineServiceRPM = Math.ceil((current + 1) / cycle) * cycle;
        }
      }
    }
  }
);

export default Compressor;
