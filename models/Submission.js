import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Submission = sequelize.define('Submission', {
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
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    file_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    submission_text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    marks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    graded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'submissions',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeUpdate: (submission) => {
        // Auto-update submitted_at on resubmission
        submission.submitted_at = new Date();
      }
    }
  });

  return Submission;
};
