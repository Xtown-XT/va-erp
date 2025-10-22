import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false, 
     pool: {
      max: 3,        
      min: 0,
      acquire: 30000, 
      idle: 10000,    
    },
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
};

export default sequelize;
