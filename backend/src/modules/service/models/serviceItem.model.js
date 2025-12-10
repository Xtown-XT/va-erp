import { DataTypes } from "sequelize";
import sequelize from "../../../config/db.js";

const ServiceItem = sequelize.define(
    "ServiceItem",
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
            defaultValue: 1,
        },
        serviceHistoryId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        spareId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        drillingToolItemId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        usageDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: "Date when spare/tool was used"
        },
        quantityUsed: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            comment: "Quantity of spare used in this service"
        }
    },
    {
        timestamps: true,
        tableName: "service_items"
    }
);

export default ServiceItem;
