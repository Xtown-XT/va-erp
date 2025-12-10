import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { commonFields } from "../../shared/models/commonFields.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      unique: 'unique_username', // Explicit index name to prevent duplicates
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin", "editor", "viewer"),
      allowNull: false,
      defaultValue: "viewer",
    },
    ...commonFields,
  },
  {
    tableName: "users",
    timestamps: true,
    paranoid: true,
  }
);

export default User;
