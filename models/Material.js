import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Material = sequelize.define('Material', {
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
    title: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    file_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    file_type: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'File extension: pdf, doc, docx, ppt, pptx, txt, url'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'materials',
    timestamps: true,
    underscored: true
  });

  return Material;
};
