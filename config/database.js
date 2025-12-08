import { Sequelize } from 'sequelize';
import 'dotenv/config';

// Railway provides MYSQL_URL, local dev uses individual vars
const databaseUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

let sequelize;

if (databaseUrl) {
  // Production: Use connection URL (Railway)
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'mysql',
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  });
} else {
  // Development: Use individual environment variables
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      dialect: 'mysql',
      logging: false,
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    }
  );
}

export default sequelize;
