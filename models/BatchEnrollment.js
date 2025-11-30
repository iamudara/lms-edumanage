import { DataTypes } from 'sequelize';

export default (sequelize) => {
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
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['batch_id', 'course_id'],
        name: 'unique_batch_course'
      }
    ]
  });

  return BatchEnrollment;
};
