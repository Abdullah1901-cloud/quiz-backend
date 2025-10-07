import { Sequelize } from "sequelize";
import db from "../../config/Database.js";
const { DataTypes } = Sequelize;

const QuizAttemptAnswerTemp = db.define('quiz_attempt_answers_temp', {
  attempt_uuid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  question_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  option_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  freezeTableName: true,
  timestamps: false,
  indexes:[
    // unique composite index supaya upsert() bekerja
    { name: 'uq_attempt_question', unique: true, fields: ['attempt_uuid','question_id'] },
    { fields: ['option_id'] },
  ]
});
export default QuizAttemptAnswerTemp;
