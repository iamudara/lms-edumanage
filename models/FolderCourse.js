import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const FolderCourse = sequelize.define('FolderCourse', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    folder_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'folders',
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
    },
    added_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Teacher who shared this folder with the course'
    }
  }, {
    tableName: 'folder_courses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // No updated_at for this junction table
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['folder_id', 'course_id'],
        name: 'unique_folder_course'
      }
    ]
  });

  return FolderCourse;
};
