import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const DailyEntry = sequelize.define(
  "DailyEntry",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    refNo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    // Machine RPM - opening and closing
    machineOpeningRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    machineClosingRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    // Compressor RPM - opening and closing
    compressorOpeningRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    compressorClosingRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    // Diesel and meter readings
    dieselUsed: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    // HSD usage
    machineHSD: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    compressorHSD: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    meter: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    // Number of holes drilled
    noOfHoles: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },
    machineServiceDone: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    compressorServiceDone: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Service items used (stored as JSON for backward compatibility)
    machineServiceItems: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    compressorServiceItems: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Shift number (1 or 2)
    shift: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        isIn: [[1, 2]],
      },
    },

    // Primary employee (optional - controller sets from employees array)
    employeeId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "employeeList",
        key: "id",
      },
    },
    // FKs
    siteId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "site",
        key: "id",
      },
    },
    machineId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "machine",
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
    ...commonFields,
  },
  {
    tableName: "dailyEntry",
    timestamps: true,
    paranoid: true,
  }
);

export default DailyEntry;
