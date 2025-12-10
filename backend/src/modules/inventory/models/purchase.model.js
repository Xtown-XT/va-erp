import { DataTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { commonFields } from "../../../shared/models/commonFields.js";

const Purchase = sequelize.define(
    "Purchase",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false,
        },
        spareId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "spares",
                key: "id",
            },
        },
        drillingToolId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "drilling_tools",
                key: "id",
            },
        },
        supplierId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "supplier",
                key: "id",
            },
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        unitPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        totalPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        ...commonFields,
    },
    {
        tableName: "purchases",
        timestamps: true,
        paranoid: true,
    }
);

export default Purchase;
