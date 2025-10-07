import { Sequelize } from 'sequelize';
import db from '../config/Database.js';

const { DataTypes } = Sequelize;

const Badges = db.define(
  'badges',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    point_value: {
      type: DataTypes.INTEGER, 
      defaultValue: 0,
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
  },
  {
    freezeTableName: true,
    timestamps: true, // default true, memastikan createdAt & updatedAt otomatis
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes:[
      {
        fields: ['name'],
      }
    ]
  }
);

export default Badges;
