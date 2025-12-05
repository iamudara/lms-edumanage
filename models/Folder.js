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
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'folders',
        key: 'id'
      },
      comment: 'Self-reference for nested folders. NULL = root level folder'
    },
    is_shared: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'True if folder is shared with multiple courses'
    }
  }, {
    tableName: 'folders',
    timestamps: true,
    underscored: true
  });

  return Folder;
};
