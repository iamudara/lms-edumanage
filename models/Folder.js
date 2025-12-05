import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Folder = sequelize.define('Folder', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'folders',
        key: 'id'
      },
      comment: 'Self-reference for nested folders. NULL = root level folder'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Teacher who created/owns this folder'
    },
    is_shared: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'True if folder is shared with any course'
    }
  }, {
    tableName: 'folders',
    timestamps: true,
    underscored: true
  });

  return Folder;
};
