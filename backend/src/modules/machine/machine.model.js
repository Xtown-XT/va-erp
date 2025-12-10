import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const Machine = sequelize.define(
    "Machine",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        machineType: {
            type: DataTypes.STRING, // crawler, camper, truck, etc.
            allowNull: false,
            field: "machineType",
        },
        machineNumber: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            field: "machineNumber",
        },
        machineRPM: {
            type: DataTypes.DOUBLE,
            allowNull: true,
            field: "machineRPM",
        },
        status: {
            type: DataTypes.ENUM("active", "inactive"),
            allowNull: false,
            defaultValue: "active",
        },
        brandId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: "brand",
                key: "id",
            },
        },
        nextServiceRPM: {
            type: DataTypes.DOUBLE,
            allowNull: true,
        },
        serviceCycleRpm: {
            type: DataTypes.INTEGER,
            defaultValue: 250,
            comment: "RPM interval for service notification",
        },

        compressorId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "compressor",
                key: "id",
            },
        },
        siteId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "site",
                key: "id",
            },
        },
        ...commonFields,
    },
    {
        tableName: "machine",
        timestamps: true,
        paranoid: true,
        hooks: {
            beforeCreate: (machine) => {
                if (machine.machineRPM !== undefined && machine.serviceCycleRpm && !machine.nextServiceRPM) {
                    // Set initial nextServiceRPM to next multiple of cycle
                    const current = Number(machine.machineRPM) || 0;
                    const cycle = Number(machine.serviceCycleRpm);
                    machine.nextServiceRPM = Math.ceil((current + 1) / cycle) * cycle;
                }
            },
            beforeUpdate: (machine) => {
                // If service cycle changes, realign nextServiceRPM
                if (machine.changed('serviceCycleRpm')) {
                    const current = Number(machine.machineRPM) || 0;
                    const cycle = Number(machine.serviceCycleRpm);
                    machine.nextServiceRPM = Math.ceil((current + 1) / cycle) * cycle;
                }
            }
        }
    }
);

export default Machine;
