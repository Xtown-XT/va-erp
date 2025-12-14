import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const DrillingToolInstallation = sequelize.define(
    "DrillingToolInstallation",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        drillingToolId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: "drilling_tools",
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
        siteId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: "site",
                key: "id",
            },
        },
        status: {
            type: DataTypes.ENUM("ACTIVE", "COMPLETED"),
            defaultValue: "ACTIVE",
            allowNull: false,
        },
        // Fitted Details
        fittedDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        fittedRPM: {
            type: DataTypes.DOUBLE,
            allowNull: true,
        },
        fittedMeter: {
            type: DataTypes.DOUBLE,
            allowNull: true,
        },
        // Removed Details
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
            allowNull: true,
        },
        // Tracking
        initialAccumulatedMeter: {
            type: DataTypes.DOUBLE,
            defaultValue: 0,
            comment: "Accumulated meter of the tool BEFORE this installation",
        },
        currentAccumulatedMeter: {
            type: DataTypes.DOUBLE,
            defaultValue: 0,
            comment: "Total meter run by tool including current installation",
        },
        ...commonFields,
    },
    {
        tableName: "drilling_tool_installations",
        timestamps: true,
        paranoid: true,
    }
);

export default DrillingToolInstallation;
