import { DataTypes } from "sequelize";
import sequelize from "../../../config/db.js";

const ServiceHistory = sequelize.define(
    "ServiceHistory",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        serviceDate: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        serviceName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        serviceType: {
            type: DataTypes.ENUM("Machine Service", "Compressor Service", "Engine Service", "Other"),
            allowNull: false,
        },
        remarks: {
            type: DataTypes.TEXT,
        },
        currentRpm: {
            type: DataTypes.INTEGER,
        },
        machineId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        compressorId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        siteId: {
            type: DataTypes.UUID,
            allowNull: true, // Optional for now, but good for filtering
        }
    },
    {
        timestamps: true,
    }
);

export default ServiceHistory;
