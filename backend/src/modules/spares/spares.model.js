import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const Spares = sequelize.define(
    "Spares",
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
        partNumber: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        units: {
            type: DataTypes.ENUM('kg', 'litre', 'meters', 'nos', 'set', 'unit', 'kit'),
            allowNull: true,
        },
        spareType: {
            type: DataTypes.ENUM('machine', 'compressor'),
            allowNull: true,
        },
        price: {
            type: DataTypes.DECIMAL(10, 2), // Base Price
            allowNull: true,
            defaultValue: 0,
        },
        // image removed as per user request
        ...commonFields,
    },
    {
        tableName: "spares",
        timestamps: true,
        paranoid: true,
    }
);

export default Spares;
