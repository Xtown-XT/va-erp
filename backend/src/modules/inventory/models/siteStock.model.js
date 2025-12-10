import { DataTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { commonFields } from "../../../shared/models/commonFields.js";

const SiteStock = sequelize.define(
    "SiteStock",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        siteId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: "site", // Check if table name is 'sites' in Site model
                key: "id",
            },
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
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        ...commonFields,
    },
    {
        tableName: "site_stocks",
        timestamps: true,
        paranoid: true,
    }
);

export default SiteStock;
