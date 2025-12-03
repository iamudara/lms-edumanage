import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const AssignmentMaterial = sequelize.define('AssignmentMaterial', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    assignment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'assignments',
        key: 'id'
      }
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('file', 'url'),
      allowNull: false,
      comment: 'file = uploaded file, url = external link'
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Cloudinary URL for files, or external URL for links'
    },
    file_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'MIME type for uploaded files (e.g., application/pdf)'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'assignment_materials',
    timestamps: true,
    underscored: true
  });

  return AssignmentMaterial;
};
