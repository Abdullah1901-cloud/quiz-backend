import { DataTypes } from 'sequelize';
import db from '../config/Database.js';

const Session = db.define('sessions', {
  sid: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  expires: {
    type: DataTypes.DATE,
  },
  data: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'sessions',
  timestamps: false,
});

export default Session;
