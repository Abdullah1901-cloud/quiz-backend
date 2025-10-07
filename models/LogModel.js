import { Sequelize } from 'sequelize';
import db from '../config/Database.js';

const { DataTypes } = Sequelize;

const Logs = db.define(
  'logs',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    entity: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    identifier: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    createdAt: 'timestamp',
    updatedAt: false,
  }
);

export default Logs;
