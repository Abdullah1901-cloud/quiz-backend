import { Sequelize } from 'sequelize';
import db from '../config/Database.js';

const { DataTypes } = Sequelize;

const Quizz = db.define(
  'quizzes',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    study_material: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    total_question: {
      type: DataTypes.INTEGER, 
      defaultValue: 10,
      allowNull: false,
    },
    teacher_id: {
      type: DataTypes.STRING(50), 
      allowNull: false,
      references: {
        model: 'teachers',
        key: 'user_id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    courses_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      references: {
        model: 'courses',
        key: 'kd_mapel',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'classes',
        key: 'id',
      },
    },
    duration: {
      type: DataTypes.INTEGER,
      defaultValue: 60,
    },
    strict: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    image: {
      type: DataTypes.STRING(50),
      allowNull: true,
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
      allowNull: false,
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
    start:{
      type: DataTypes.DATE,
      allowNull: false,
    },
    end:{
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
        fields: ['is_active','start', 'end','is_deleted','image','class_id','teacher_id'],
      }
    ]
  }
);

export default Quizz;
