import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const EmployeeList = sequelize.define(
  "Employee",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    empId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      allowNull: false,
      // unique: true, // Commented out to fix ER_TOO_MANY_KEYS error during sync
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    designation: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    joiningDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "resigned"),
      allowNull: false,
      defaultValue: "active",
    },
    // Foreign key for Site
    siteId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "site",
        key: "id",
      },
    },
    // Daily Salary
    dailySalary: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    // Advanced amount field
    advancedAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
    },
    ...commonFields,
  },
  {
    tableName: "employeeList",
    timestamps: true,
    paranoid: true,
  }
);

export default EmployeeList;
