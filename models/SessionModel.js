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
  user_id:{
    type: DataTypes.STRING,
    defaultValue:null
  }
}, {
  tableName: 'sessions',
  timestamps: false,
});

export default Session;
