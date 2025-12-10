import { DataTypes } from "sequelize";
import sequelize from "../../../config/db.js";

const PurchaseOrder = sequelize.define(
    "PurchaseOrder",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        poNumber: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        status: {
            type: DataTypes.ENUM("Pending", "Received", "Cancelled"),
            defaultValue: "Pending",
        },
        gstInclude: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        gstPercent: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0,
        },
        totalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        remarks: {
            type: DataTypes.STRING,
        },
        supplierId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "supplier",
                key: "id",
            },
        },
        addressId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "address",
                key: "id",
            },
        },
        shippingAddressId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "address",
                key: "id",
            },
        },
        receivedBy: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        receivedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        }
    },
    {
        timestamps: true,
        paranoid: false,
    }
);

export default PurchaseOrder;
