const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Batch = sequelize.define(
    "Batch",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT },
      year: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      tableName: "batches",
      timestamps: true,
      underscored: true,
    }
  );

  return Batch;
};
