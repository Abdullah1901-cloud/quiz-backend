import { Sequelize } from 'sequelize';
import db from '../config/Database.js';

const { DataTypes } = Sequelize;

const StudentPointsLog = db.define(
  'student_points_log',
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
    points: {
      type: DataTypes.INTEGER, 
      defaultValue: 0,
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    timestamps: true, // default true, memastikan createdAt & updatedAt otomatis
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes:[
      {
        fields: ['source'],
      }
    ]
  }
);

export default StudentPointsLog;
