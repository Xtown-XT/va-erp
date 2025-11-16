import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const Machine = sequelize.define(
  "Machine",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    vehicleType: {
      type: DataTypes.STRING, // crawler, camper, truck, etc. (kept for DB compatibility)
      allowNull: false,
      field: "vehicleType", // Explicitly map to DB column
    },
    vehicleNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "vehicleNumber", // Explicitly map to DB column
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    brandId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "brand",
        key: "id",
      },
    },
    vehicleRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      field: "vehicleRPM", // Explicitly map to DB column
    },
    nextServiceRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    compressorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "compressor",
        key: "id",
      },
    },
    siteId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "site",
        key: "id",
      },
    },
    ...commonFields,
  },
  {
    tableName: "vehicle", // Keep DB table name
    timestamps: true,
    paranoid: true,
  }
);

export default Machine;
