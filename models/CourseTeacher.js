import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const CourseTeacher = sequelize.define('CourseTeacher', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'courses',
        key: 'id'
      }
    },
    teacher_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    can_edit: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    can_grade: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    tableName: 'course_teachers',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['course_id', 'teacher_id']
      }
    ]
  });

  return CourseTeacher;
};
