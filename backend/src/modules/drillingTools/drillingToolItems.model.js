import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const DrillingToolItems = sequelize.define(
    "DrillingToolItems",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        serialNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true, // Assuming serial numbers should be unique if present
        },
        currentRpm: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        currentMeter: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        totalRPM: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        totalMeter: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        status: {
            type: DataTypes.ENUM("In Stock", "Fitted", "Discarded", "Under Repair"),
            defaultValue: "In Stock",
        },
        // Foreign Keys will be defined in associations.js
        // drillingToolId (Catalog)
        // siteId (Current Location)
        // fittedMachineId (If fitted)
        // fittedCompressorId (If fitted)
    },
    {
        timestamps: true,
    }
);

export default DrillingToolItems;
