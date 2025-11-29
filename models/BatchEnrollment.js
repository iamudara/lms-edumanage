const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BatchEnrollment = sequelize.define('BatchEnrollment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    batch_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'batches',
        key: 'id'
      }
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'courses',
        key: 'id'
      }
    }
  }, {
    tableName: 'batch_enrollments',
    timestamps: true,
    underscored: true
  });

  return BatchEnrollment;
};
