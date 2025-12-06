import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Course = sequelize.define('Course', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'e.g., "2024 Fall", "2025 Spring", "Semester 1"'
    }
  }, {
    tableName: 'courses',
    timestamps: true,
    underscored: true
  });

  return Course;
};
