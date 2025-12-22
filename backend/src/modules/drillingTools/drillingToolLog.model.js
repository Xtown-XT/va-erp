import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const DrillingToolLog = sequelize.define(
    "DrillingToolLog",
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
        dailyEntryId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "dailyEntry",
                key: "id",
            },
        },
        action: {
            type: DataTypes.ENUM('INSTALL', 'REMOVE'),
            allowNull: false,
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        quantity: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            allowNull: false,
        },
        currentMachineRPM: {
            type: DataTypes.DOUBLE,
            allowNull: true,
            comment: "Machine RPM at the time of action",
        },
        currentMachineMeter: {
            type: DataTypes.DOUBLE,
            allowNull: true,
            comment: "Machine Meter reading at the time of action",
        },
        ...commonFields,
    },
    {
        tableName: "drilling_tool_logs",
        timestamps: true,
        paranoid: true,
    }
);

export default DrillingToolLog;
