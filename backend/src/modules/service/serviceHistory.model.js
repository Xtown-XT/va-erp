import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const ServiceHistory = sequelize.define(
    "ServiceHistory",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        machineId: {
            type: DataTypes.UUID,
            allowNull: true,
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
        serviceType: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        currentRPM: {
            type: DataTypes.DOUBLE,
            allowNull: false,
        },
        siteId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "site",
                key: "id",
            },
        },
        dailyEntryId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "dailyEntry",
                key: "id",
            },
        },
        sparesUsed: {
            type: DataTypes.JSON, // Array of { spareId, name, quantity }
            allowNull: true,
            defaultValue: [],
        },
        ...commonFields,
    },
    {
        tableName: "service_history",
        timestamps: true,
        paranoid: true,
    }
);

export default ServiceHistory;
