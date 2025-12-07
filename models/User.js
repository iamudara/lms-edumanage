import { DataTypes } from 'sequelize';
import bcrypt from 'bcrypt';

export default (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      full_name: { type: DataTypes.STRING(100), allowNull: false },
      role: {
        type: DataTypes.ENUM("admin", "teacher", "student"),
        allowNull: false,
      },
      batch_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // NULL for admin/teacher, required for students
        references: { model: "batches", key: "id" },
      },
      active_session_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Current active session ID - only one session allowed per user'
      },
    },
    {
      tableName: "users",
      timestamps: true,
      underscored: true,
      hooks: {
        /**
         * Hash password before creating user
         */
        beforeCreate: async (user) => {
          if (user.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        },
        /**
         * Hash password before updating user (if password changed)
         */
        beforeUpdate: async (user) => {
          if (user.changed('password')) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        },
      },
    }
  );

  /**
   * Instance method to compare password
   * Used during authentication
   * @param {string} candidatePassword - Password to compare
   * @returns {Promise<boolean>} - True if password matches
   */
  User.prototype.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  };

  /**
   * Class method to hash password
   * Used when creating/updating users programmatically
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  User.hashPassword = async function(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  };

  return User;
};
