import { Sequelize, UUID } from 'sequelize';
import db from '../config/Database.js';

const { DataTypes } = Sequelize;
const Users = db.define(
  'users',
  {
    uuid: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    user_id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      validate: {
        notEmpty: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: {
          args: [8, 100],
          msg: 'Password must be between 8 and 255 characters long',
        },
      },
    },
    role: {
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

export default Users;
