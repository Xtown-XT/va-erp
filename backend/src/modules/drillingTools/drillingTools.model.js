import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const DrillingTools = sequelize.define(
    "DrillingTools",
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


        price: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },

        rpmSource: {
            type: DataTypes.ENUM("machine", "compressor"),
            allowNull: false,
            defaultValue: "machine",
            comment: "Determines which closing RPM to record (machine or compressor)",
        },
        ...commonFields,
    },
    {
        tableName: "drilling_tools",
        timestamps: true,
        paranoid: true,
    }
);

export default DrillingTools;
