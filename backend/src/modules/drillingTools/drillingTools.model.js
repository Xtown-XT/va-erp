import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const DrillingTools = sequelize.define(
    "DrillingTools",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        partNumber: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        category: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        totalRPM: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        totalMeter: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        copyRpm: {
            type: DataTypes.ENUM("machine", "compressor", "none"),
            defaultValue: "none",
            comment: "Inherit RPM from Machine or Compressor",
        },
        ...commonFields,
    },
    {
        tableName: "drilling_tools",
        timestamps: true,
        paranoid: true,
    }
);

export default DrillingTools;
