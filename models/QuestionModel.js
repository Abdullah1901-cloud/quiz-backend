import { Sequelize } from 'sequelize';
import db from '../config/Database.js';

const { DataTypes } = Sequelize;

const Question = db.define(
  'questions',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    quiz_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'quizzes',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    question_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    image: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    point: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      get() {
        const rawValue = this.getDataValue('point');
        return rawValue !== null ? parseFloat(rawValue) : 0;
      },
    },
  },
  {
    freezeTableName: true,
    timestamps: true, // default true, memastikan createdAt & updatedAt otomatis
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes:[
      {
        fields: ['image'],
      }
    ]
  }
);

export default Question;
