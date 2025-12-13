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
            type: DataTypes.STRING, // crawler, camper, truck, etc.
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
        lastServiceRPM: {
            type: DataTypes.DOUBLE,
            allowNull: true,
            defaultValue: 0,
            comment: "Last RPM when General/Hydraulic service was done",
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
            comment: "Cycle for General/Hydraulic service",
        },
        engineServiceCycleRpm: {
            type: DataTypes.INTEGER,
            defaultValue: 250,
            comment: "Cycle for Engine service",
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
