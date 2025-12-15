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
        machineType: {
            type: DataTypes.STRING, 
            allowNull: false,
            field: "machineType",
        },
        machineNumber: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            field: "machineNumber",
        },
        machineRPM: {
            type: DataTypes.DOUBLE,
            allowNull: true,
            field: "machineRPM",
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

  
        maintenanceConfig: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: [],
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
        tableName: "machine",
        timestamps: true,
        paranoid: true,
    }
);

export default Machine;
