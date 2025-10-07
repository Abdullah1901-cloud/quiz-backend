import { Sequelize } from 'sequelize';
import db from '../config/Database.js';

const { DataTypes } = Sequelize;

const StudentBadges = db.define(
  'student_badges',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    student_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      references: {
        model: 'students',
        key: 'user_id',
      },
    },
    badges_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'badges',
        key: 'id',
      },
    },
    quantity: {
      type: DataTypes.INTEGER, 
      defaultValue: 0,
      allowNull: false,
    },
    earned_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    }
  },
  {
    freezeTableName: true,
    timestamps: true, // default true, memastikan createdAt & updatedAt otomatis
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default StudentBadges;
