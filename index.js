import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import UserRoute from './routes/UserRoute.js';
import StudentRoute from './routes/StudentRoute.js';
import TeacherRoute from './routes/TeacherRoute.js';
import AdminRoute from './routes/AdminRoute.js';
import ClassRoute from './routes/ClassRoute.js';
import CourseRoute from './routes/CourseRoute.js';
import QuizzRoute from './routes/QuizzRoute.js';
import QuizzAttemptRoute from './routes/QuizzAttemptRoute.js';
import QuizzRekapRoute from './routes/QuizzRekapRoute.js';
import StudentBadgesRoute from './routes/StudentBadgesRoute.js';
import StudentProgresRoute from './routes/StudentProgresRoute.js';
import db from './config/Database.js';
import AuthRoute from './routes/AuthRoute.js';
import SequelizeStore from 'connect-session-sequelize';
import applyAssociations from './models/associations.js';

dotenv.config();

const app = express();

const SequelizeSessionStore = SequelizeStore(session.Store);
const sessionStore = new SequelizeSessionStore({
  db: db,
  checkExpirationInterval: 15 * 60 * 1000, // Bersihkan session tiap 15 menit
  expiration: 30 * 24 * 60 * 60 * 1000, // Expired di database setelah 30 hari
});

(async () => {
  try {
    await db.authenticate();
    console.log('Database connected successfully');

    await import('./models/UserModel.js');
    await import('./models/StudentModel.js');
    await import('./models/TeacherModel.js');
    await import('./models/AdminModel.js');
    await import('./models/ClassModel.js');
    await import('./models/CourseModel.js');
    await import('./models/QuizzModel.js');
    await import('./models/QuestionModel.js');
    await import('./models/OptionModel.js');
    await import('./models/studentQuizz/quizzAttemptAnswerTempModel.js');
    await import('./models/studentQuizz/quizzAttemptModel.js');
    await import('./models/studentQuizz/studentAnswerModel.js');
    await import('./models/BadgeModel.js');
    await import('./models/StudentBadgesModel.js');
    await import ('./models/StudentPointsLogModel.js');

    // ⬇️ Jalankan asosiasi antar model
    applyAssociations();
    await db.sync();
    // await sessionStore.sync();
    await import('./cron.js');
    console.log('Models and session store synced');
  } catch (error) {
    console.error('Database connection failed:', error);
  }
})();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    store: sessionStore,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000, //30 Hari
    },
  })
);
app.use(
  cors({
    credentials: true,
    origin: ['https://platformtugas.netlify.app'],
  })
);
app.use(express.json());
app.use(express.static('public'));

//Routes
app.use(UserRoute);
app.use(AdminRoute);
app.use(StudentRoute);
app.use(TeacherRoute);
app.use(AuthRoute);
app.use(ClassRoute);
app.use(CourseRoute);
app.use(QuizzRoute);
app.use(StudentProgresRoute);
app.use(QuizzAttemptRoute);
app.use(QuizzRekapRoute);
app.use(StudentBadgesRoute);

app.set('trust proxy', true);

app.listen(process.env.DB_PORT || 3306, () => {
  console.log(`Server is running on port ${process.env.APP_PORT || 3306}`);
});
