import { DataTypes } from "sequelize";
import sequelize from "../../../config/db.js";

const PurchaseOrderItem = sequelize.define(
    "PurchaseOrderItem",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        itemType: {
            type: DataTypes.ENUM("spare", "drillingTool"),
            allowNull: false,
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: { min: 1 },
        },
        unitPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        totalPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        purchaseOrderId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        spareId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        drillingToolId: {
            type: DataTypes.UUID,
            allowNull: true,
        }
    },
    {
        timestamps: true,
    }
);

export default PurchaseOrderItem;
