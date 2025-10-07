import { Sequelize, UUID } from 'sequelize';
import db from '../../config/Database.js';
const { DataTypes } = Sequelize;

const StudentQuizAttempt = db.define(
  'student_quiz_attempts',
  {
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
      validate: {
        notEmpty: true,
      },
    },
    student_user_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      references: { model: 'students', key: 'user_id' },
    },
    quiz_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'quizzes', key: 'id' },
    },
    // Gunakan DECIMAL agar tidak kehilangan pecahan
    score: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
      get() {
        const rawValue = this.getDataValue('score');
        return rawValue !== null ? parseFloat(rawValue) : 0;
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    // biarkan default null sehingga attempt in-progress punya attempted_at = null
    attempted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    violation_count:{
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    status:{
      type: DataTypes.ENUM('belum-mengerjakan', 'sedang-mengerjakan', 'selesai','tidak-mengerjakan'),
      allowNull: false,
      defaultValue: 'belum-mengerjakan',
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    timestamps: false,
    indexes: [
      { fields: ['student_user_id', 'quiz_id'], unique: true }, // unique constraint
      { fields: ['attempted_at'] }, // index for faster queries
      { fields: ['status'] }, // index for faster queries // index for faster queries
    ],
  }
);
export default StudentQuizAttempt;
