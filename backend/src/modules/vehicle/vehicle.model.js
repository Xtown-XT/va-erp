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
      type: DataTypes.STRING, // crawler, camper, truck, etc.
      allowNull: false,
      field: "vehicleType",
    },
    vehicleNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "vehicleNumber",
    },
    vehicleRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      field: "vehicleRPM",
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
    nextServiceRPM: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    serviceCycleRpm: {
      type: DataTypes.INTEGER,
      defaultValue: 250,
      comment: "RPM interval for service notification",
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
