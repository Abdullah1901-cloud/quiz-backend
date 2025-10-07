import { Sequelize, UUID } from 'sequelize';
import db from '../config/Database.js';

const { DataTypes } = Sequelize;
const Courses = db.define(
  'courses',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    kd_mapel: {
      type: DataTypes.STRING(10),
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    nama_mapel: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,        
      },
    },
    created_by: {
      type: DataTypes.STRING(50),
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    updated_by: {
      type: DataTypes.STRING(50),
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    updated_by_role: {
      type: DataTypes.ENUM('administrator', 'teacher', 'student'),
      allowNull: false,
      validate: {
        notEmpty: true,
        isIn: {
          args: [['administrator', 'teacher', 'student']],
          msg: 'Role must be either administrator, teacher, or student',
        },
      },
    },
  },
  {
    freezeTableName: true,
    timestamps: true, // default true, memastikan createdAt & updatedAt otomatis
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Courses;
