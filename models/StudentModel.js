import { Sequelize } from 'sequelize';
import db from '../config/Database.js';

const { DataTypes } = Sequelize;

const Students = db.define(
  'students',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'user_id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'classes',
        key: 'id',
      },
    },
    streak_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    last_submission_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    photo: {
      type: DataTypes.STRING(50),
      allowNull: true,
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
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    timestamps: true, // default true, memastikan createdAt & updatedAt otomatis
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['class_id'],
      },
    ],
  }
);

export default Students;
