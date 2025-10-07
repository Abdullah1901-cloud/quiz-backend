import { Sequelize } from 'sequelize';
import db from '../config/Database.js';

const { DataTypes } = Sequelize;

const Classes = db.define(
  'classes',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    class_name: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
    },
    wali_kelas: {
      type: DataTypes.STRING(50),
      allowNull: true,
      references: {
        model: 'teachers', // nama tabel teachers
        key: 'user_id', // FK ke kolom user_id di tabel teachers
      },
    },
    created_by: {
      type: DataTypes.STRING(50),
      allowNull: false,
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
export default Classes;
