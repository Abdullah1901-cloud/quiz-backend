import { Sequelize } from "sequelize";
import db from "../../config/Database.js";
const { DataTypes } = Sequelize;
const StudentAnswer = db.define('student_answers', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  attempt_uuid: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'student_quiz_attempts', key: 'uuid' },
    onDelete: 'CASCADE',
  },
  question_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'questions', key: 'id' },
    onDelete: 'CASCADE',
  },
  selected_option_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'options', key: 'id' },
    onDelete: 'SET NULL',
  },
}, {
  freezeTableName: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});
export default StudentAnswer;