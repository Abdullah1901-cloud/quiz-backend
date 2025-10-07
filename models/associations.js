// models/associations.js
import Users from './UserModel.js';
import Students from './StudentModel.js';
import Teachers from './TeacherModel.js';
import Admins from './AdminModel.js';
import Classes from './ClassModel.js';
import Courses from './CourseModel.js';
import Quizz from './QuizzModel.js';
import Question from './QuestionModel.js';
import Option from './OptionModel.js';
import StudentQuizAttempt from './studentQuizz/quizzAttemptModel.js';
import StudentPointsLog from './StudentPointsLogModel.js';
import StudentAnswer from './studentQuizz/studentAnswerModel.js';
import Badges from './BadgeModel.js';
import StudentBadges from './StudentBadgesModel.js';

// StudentBadges → BelongsTo
StudentBadges.belongsTo(Students, { 
  foreignKey: 'student_id',   // kolom FK di StudentBadges
  targetKey: 'user_id',       // kolom PK (unik) di Students
  as: 'studentDetails'
});

StudentBadges.belongsTo(Badges, { 
  foreignKey: 'badges_id',  
  targetKey: 'id',          
  as: 'badgeDetails'
});

// Badge → HasMany StudentBadges
Badges.hasMany(StudentBadges, { 
  foreignKey: 'badges_id', 
  sourceKey: 'id',
  as: 'studentBadges'
});

// Users → One-to-One
Users.hasOne(Students, { foreignKey: 'user_id', as: 'studentDetails' });
Users.hasOne(Teachers, { foreignKey: 'user_id', as: 'teacherDetails' });
Users.hasOne(Admins, { foreignKey: 'user_id', as: 'adminDetails' });

// Students → BelongsTo
Students.belongsTo(Classes, { foreignKey: 'class_id', as: 'wali_kelas' });
Students.belongsTo(Users, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator' });
Students.belongsTo(Users, { foreignKey: 'updated_by', targetKey: 'user_id', as: 'updater' });

// Students → HasMany
Students.hasMany(StudentQuizAttempt, { 
  foreignKey: 'student_user_id', 
  sourceKey: 'user_id',
  as: 'attempts' 
});
Students.hasMany(StudentBadges, { 
  foreignKey: 'student_id',   // kolom FK di StudentBadges
  sourceKey: 'user_id',       // kolom unik di Students
  as: 'badges'
});

// Teachers → BelongsTo
Teachers.belongsTo(Users, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator' });
Teachers.belongsTo(Users, { foreignKey: 'updated_by', targetKey: 'user_id', as: 'updater' });

// Classes → BelongsTo
Classes.belongsTo(Users, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator' });
Classes.belongsTo(Users, { foreignKey: 'updated_by', targetKey: 'user_id', as: 'updater' });

// Classes → HasMany
Classes.hasMany(Students, { foreignKey: 'class_id', as: 'students' });
Classes.hasMany(Quizz, { foreignKey: 'class_id', as: 'quizzes' });

// Courses → BelongsTo
Courses.belongsTo(Users, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator' });
Courses.belongsTo(Users, { foreignKey: 'updated_by', targetKey: 'user_id', as: 'updater' });

// Quizz → BelongsTo
Quizz.belongsTo(Classes, {
  foreignKey: 'class_id',
  targetKey: 'id',
  as: 'classDetails',
});
Quizz.belongsTo(Users, {
  foreignKey: 'created_by',
  targetKey: 'user_id',
  as: 'creator',
});
Quizz.belongsTo(Teachers, {
  foreignKey: 'teacher_id',
  targetKey: 'user_id',
  as: 'teacherDetails',
});
Quizz.belongsTo(Users, {
  foreignKey: 'updated_by',
  targetKey: 'user_id',
  as: 'updater',
});
Quizz.belongsTo(Courses, {
  foreignKey: 'courses_id',
  targetKey: 'kd_mapel',
  as: 'coursesIdDetails',
});
// Quizz → HasMany
Quizz.hasMany(Question, {
  foreignKey: 'quiz_id',
  as: 'questions',
  sourceKey: 'id',
});

Quizz.hasMany(StudentQuizAttempt, { 
  foreignKey: 'quiz_id', 
  sourceKey: 'id',
  as: 'attempts' 
});

// Question → BelongsTo
Question.belongsTo(Quizz, {
  foreignKey: 'quiz_id',
  targetKey: 'id',
  as: 'quizzDetails',
});
// Question → HasMany
Question.hasMany(Option, {
  foreignKey: 'question_id',
  sourceKey: 'id',
  as: 'options',
});
// Option → BelongsTo
Option.belongsTo(Question, {
  foreignKey: 'question_id',
  targetKey: 'id',
  as: 'questionDetails',
});

// Classes → BelongsTo Wali Kelas
Classes.belongsTo(Teachers, {
  foreignKey: 'wali_kelas',
  targetKey: 'user_id',
  as: 'waliKelasGuru',
});

// Admin Created/Updated By Admin
Admins.belongsTo(Users, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator' });
Admins.belongsTo(Users, { foreignKey: 'updated_by', targetKey: 'user_id', as: 'updater' });


// StudentQuizAttempt → BelongsTo
StudentQuizAttempt.belongsTo(Quizz, { 
  foreignKey: 'quiz_id', 
  as: 'quiz' 
});
StudentQuizAttempt.belongsTo(Students, { 
  foreignKey: 'student_user_id', 
  targetKey: 'user_id',
  as: 'student' 
});


// StudentQuizAttempt → HasMany
StudentQuizAttempt.hasMany(StudentAnswer, { foreignKey: 'attempt_uuid', as: 'studentAnswers' });
// StudentQuizAttempt.hasMany(Question, { foreignKey: 'quiz_id', as: 'questions' });


// StudentAnswer → BelongsTo
StudentAnswer.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });
StudentAnswer.belongsTo(Option, { foreignKey: 'selected_option_id', as: 'option' });

StudentPointsLog.belongsTo(Students, { 
  foreignKey: 'student_id', 
  targetKey: 'user_id',
  as: 'student' 
});

Students.hasMany(StudentPointsLog, { 
  foreignKey: 'student_id', 
  sourceKey: 'user_id',
  as: 'pointsLog' 
});

export default function applyAssociations() {
  // Tidak perlu isi apapun, impor file ini saja sudah cukup
}
