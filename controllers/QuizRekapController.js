// controllers/quizRecapController.js
import Quizz from '../models/QuizzModel.js';
import ClassModel from '../models/ClassModel.js';
import Courses from '../models/CourseModel.js';
import Students from '../models/StudentModel.js';
import Teachers from '../models/TeacherModel.js';
import StudentQuizAttempt from '../models/studentQuizz/quizzAttemptModel.js';

// Fungsi format durasi (ms -> mm:ss atau hh:mm:ss)
function formatDuration(startOrSeconds, endMs) {
  let diffMs;

  if (typeof startOrSeconds === 'number') {
    // langsung terima total ms
    diffMs = startOrSeconds;
  } else {
    // formatDuration(startDate, endDate)
    diffMs = new Date(endMs) - new Date(startOrSeconds);
  }

  if (diffMs < 0) return null;

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      seconds
    ).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const getClassQuizzesSummary = async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      message: 'Mohon login terlebih dahulu',
    });
  }
  try {
    const class_id = req.params.class_id;
    const created_by = req.session.user.user_id;
    // Ambil semua quiz di kelas tersebut
    const quizzes = await Quizz.findAll({
      where: { class_id, created_by },
      include: [
        {
          model: ClassModel,
          as: 'classDetails',
          include: [
            {
              model: Students,
              as: 'students',
              attributes: ['id', 'user_id', 'name'],
            },
          ],
        },
      ],
      order: [['created_at', 'ASC']],
    });

    if (!quizzes.length) {
      return res.status(404).json({ msg: 'No quizzes found for this class' });
    }

    // Semua siswa di kelas (pakai dari quiz pertama)
    const students = quizzes[0].classDetails?.students || [];

    // Ambil semua attempts untuk semua quiz ini
    const quizIds = quizzes.map((q) => q.id);
    const attempts = await StudentQuizAttempt.findAll({
      where: { quiz_id: quizIds },
      raw: true,
    });

    if (attempts.length === 0) {
      return res.status(404).json({ msg: 'No attempts found for this class' });
    }

    // Buat lookup attempt berdasarkan quiz_id dan student_user_id
    const attemptsLookup = {};
    for (const att of attempts) {
      attemptsLookup[`${att.quiz_id}_${att.student_user_id}`] = att;
    }

    // Rekap per quiz
    const quizSummaries = quizzes.map((quiz) => {
      let alreadySubmitted = 0;
      let stillWorking = 0;
      let notStarted = 0;
      let totalScore = 0;
      let highestScore = null;
      let lowestScore = null;
      let totalDuration = 0;

      const scoreRanges = [
        { range: '0-50', min: 0, max: 50, count: 0 },
        { range: '51-70', min: 51, max: 70, count: 0 },
        { range: '71-85', min: 71, max: 85, count: 0 },
        { range: '86-100', min: 86, max: 100, count: 0 },
      ];

      const studentList = students.map((student) => {
        const attempt = attemptsLookup[`${quiz.id}_${student.user_id}`];

        if (!attempt) {
          notStarted++;
          return {
            student_user_id: student.user_id,
            student_name: student.name,
            status: 'not_started',
            score: null,
            duration: null,
          };
        }

        if (attempt.created_at && !attempt.attempted_at) {
          stillWorking++;
          return {
            student_user_id: student.user_id,
            student_name: student.name,
            status: 'still_working',
            score: null,
            duration: null,
          };
        }

        // Sudah submit
        alreadySubmitted++;
        const score = attempt.score;
        totalScore += parseFloat(score);
        highestScore = highestScore === null ? score : Math.max(highestScore, score);
        lowestScore = lowestScore === null ? score : Math.min(lowestScore, score);

        const durationMs = new Date(attempt.attempted_at) - new Date(attempt.created_at);
        totalDuration += durationMs; // untuk rata-rata

        for (const range of scoreRanges) {
          if (score >= range.min && score <= range.max) {
            range.count++;
            break;
          }
        }

        return {
          student_user_id: student.user_id,
          student_name: student.name,
          status: 'already_submitted',
          score,
          duration: formatDuration(attempt.created_at, attempt.attempted_at),
        };
      });

      studentList.sort((a, b) => a.student_name.localeCompare(b.student_name));

      const averageDuration =
        alreadySubmitted > 0 ? formatDuration(totalDuration / alreadySubmitted) : null;

      return {
        quiz_id: quiz.id,
        study_material: quiz.study_material,
        description: quiz.description,
        total_questions: quiz.total_question,
        created_at: quiz.created_at,
        total_students: students.length,
        summary: {
          already_submitted: alreadySubmitted,
          still_working: stillWorking,
          not_started: notStarted,
          average_score:
            alreadySubmitted > 0 ? parseFloat((totalScore / alreadySubmitted).toFixed(2)) : null,
          highest_score: parseFloat(highestScore),
          lowest_score: parseFloat(lowestScore),
          average_duration: averageDuration ? averageDuration : null,
        },
        score_distribution: scoreRanges,
        student_list: studentList,
      };
    });

    res.json({
      class_id,
      class_name: quizzes[0].classDetails.class_name,
      total_quizzes: quizzes.length,
      quizzes: quizSummaries,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
export const getQuizzesSummary = async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Mohon login terlebih dahulu' });
  }

  try {
    const teacher_id = req.session.user.user_id;

    // 🔹 Ambil semua quiz + info kelas (metadata)
    const quizzes = await Quizz.findAll({
      where: { teacher_id },
      include: [
        {
          model: ClassModel,
          as: 'classDetails', // sesuai association di models
          attributes: ['id', 'class_name'],
        },
        {
          model: Courses,
          as: 'coursesIdDetails',
          attributes: ['nama_mapel'], 
        },
        {
          model: Teachers,
          as: 'teacherDetails',
          attributes: ['name'],
        }
      ],
      order: [['created_at', 'ASC']],
    });

    if (!quizzes.length) {
      return res.status(404).json({ msg: 'No quizzes found' });
    }

    const quizIds = quizzes.map((q) => q.id);

    // 🔹 Ambil semua attempts + data siswa
    const attempts = await StudentQuizAttempt.findAll({
      where: { quiz_id: quizIds },
      include: [
        {
          model: Students,
          as: 'student', // alias sesuai association
          attributes: ['user_id', 'name'],
        },
      ],
    });

    // 🔹 Kelompokkan attempt per quiz
    const attemptsByQuiz = {};
    for (const att of attempts) {
      if (!attemptsByQuiz[att.quiz_id]) attemptsByQuiz[att.quiz_id] = [];
      attemptsByQuiz[att.quiz_id].push(att);
    }

    // 🔹 Olah summary per quiz
    const quizSummaries = quizzes.map((quiz) => {
      const quizAttempts = attemptsByQuiz[quiz.id] || [];

      let alreadySubmitted = 0;
      let stillWorking = 0;
      let notStarted = 0;
      let notDoing = 0;
      let totalScore = 0;
      let highestScore = null;
      let lowestScore = null;
      let totalDuration = 0;

      const scoreRanges = [
        { range: '0-50', min: 0, max: 50, count: 0 },
        { range: '51-70', min: 51, max: 70, count: 0 },
        { range: '71-85', min: 71, max: 85, count: 0 },
        { range: '86-100', min: 86, max: 100, count: 0 },
      ];

      const studentList = quizAttempts
        .map((attempt) => {
          const student = attempt.student;
          const status = attempt.status;

          if (status === 'belum-mengerjakan') {
            notStarted++;
            return {
              student_user_id: student.user_id,
              student_name: student.name,
              status,
              score: null,
              duration: null,
            };
          }

          if (status === 'sedang-mengerjakan') {
            stillWorking++;
            return {
              student_user_id: student.user_id,
              student_name: student.name,
              status,
              score: null,
              duration: null,
            };
          }

          if (status === 'tidak-mengerjakan') {
            notDoing++;
            return {
              student_user_id: student.user_id,
              student_name: student.name,
              status,
              score: null,
              duration: null,
            };
          }

          if (status === 'selesai') {
            alreadySubmitted++;
            const score = attempt.score;
            totalScore += parseFloat(score);
            highestScore = highestScore === null ? score : Math.max(highestScore, score);
            lowestScore = lowestScore === null ? score : Math.min(lowestScore, score);

            const durationMs = new Date(attempt.attempted_at) - new Date(attempt.created_at);
            totalDuration += durationMs;

            for (const range of scoreRanges) {
              if (score >= range.min && score <= range.max) {
                range.count++;
                break;
              }
            }

            return {
              student_user_id: student.user_id,
              student_name: student.name,
              status,
              score: Math.round(score),
              duration: formatDuration(attempt.created_at, attempt.attempted_at),
            };
          }

          return null;
        })
        .filter(Boolean);

      studentList.sort((a, b) => a.student_name.localeCompare(b.student_name));

      const averageDuration =
        alreadySubmitted > 0 ? formatDuration(totalDuration / alreadySubmitted) : null;

      return {
        quiz_id: quiz.id,
        study_material: quiz.study_material,
        description: quiz.description,
        class_id: quiz.class_id,
        start:quiz.start,
        teacher_name:quiz.teacherDetails?.name || null,
        courses_name: quiz.coursesIdDetails?.nama_mapel || null, // 🔥 tambah ini
        class_name: quiz.classDetails?.class_name || null, // 🔥 tambah ini
        courses_id: quiz.courses_id,
        total_questions: quiz.total_question,
        created_at: quiz.created_at,
        total_students: studentList.length,
        summary: {
          already_submitted: alreadySubmitted,
          still_working: stillWorking,
          not_started: notStarted,
          not_doing: notDoing,
          average_score:
            alreadySubmitted > 0 ? parseFloat((totalScore / alreadySubmitted).toFixed(2)) : null,
          highest_score: highestScore,
          lowest_score: lowestScore,
          average_duration: averageDuration,
        },
        score_distribution: scoreRanges,
        student_list: studentList,
      };
    });

    res.status(200).json({
      total_quizzes: quizzes.length,
      quizzes: quizSummaries,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
export const getQuizSummary = async (req, res) => {
  try {
    const quiz_id = req.params.id;

    if (!quiz_id) {
      return res.status(400).json({ msg: 'Quiz ID is required' });
    }

    // 🔹 Ambil 1 quiz dengan relasi
    const quiz = await Quizz.findOne({
      where: { id: quiz_id },
      include: [
        {
          model: ClassModel,
          as: 'classDetails',
          attributes: ['id', 'class_name'],
        },
        {
          model: Courses,
          as: 'coursesIdDetails',
          attributes: ['nama_mapel'],
        },
        {
          model: Teachers,
          as: 'teacherDetails',
          attributes: ['name'],
        },
      ],
    });

    if (!quiz) {
      return res.status(404).json({ msg: 'Quiz not found' });
    }

    // 🔹 Ambil semua attempts + data siswa
    const attempts = await StudentQuizAttempt.findAll({
      where: { quiz_id: quiz.id },
      include: [
        {
          model: Students,
          as: 'student',
          attributes: ['user_id', 'name'],
        },
      ],
    });

    let alreadySubmitted = 0;
    let stillWorking = 0;
    let notStarted = 0;
    let notDoing = 0;
    let totalScore = 0;
    let highestScore = null;
    let lowestScore = null;
    let totalDuration = 0;

    const scoreRanges = [
      { range: '0-50', min: 0, max: 50, count: 0 },
      { range: '51-70', min: 51, max: 70, count: 0 },
      { range: '71-85', min: 71, max: 85, count: 0 },
      { range: '86-100', min: 86, max: 100, count: 0 },
    ];

    const studentList = attempts
      .map((attempt) => {
        const student = attempt.student;
        const status = attempt.status;
        const violationCount = attempt.violation_count || 0;

        if (status === 'belum-mengerjakan') {
          notStarted++;
          return {
            student_user_id: student.user_id,
            student_name: student.name,
            status,
            violation_count: violationCount,
            score: null,
            duration: null,
          };
        }

        if (status === 'sedang-mengerjakan') {
          stillWorking++;
          return {
            student_user_id: student.user_id,
            student_name: student.name,
            status,
            violation_count: violationCount,
            score: null,
            duration: null,
          };
        }

        if (status === 'tidak-mengerjakan') {
          notDoing++;
          return {
            student_user_id: student.user_id,
            student_name: student.name,
            status,
            violation_count: violationCount,
            score: null,
            duration: null,
          };
        }

        if (status === 'selesai') {
          alreadySubmitted++;
          const score = attempt.score;
          totalScore += parseFloat(score);
          highestScore = highestScore === null ? score : Math.max(highestScore, score);
          lowestScore = lowestScore === null ? score : Math.min(lowestScore, score);

          const durationMs = new Date(attempt.attempted_at) - new Date(attempt.created_at);
          totalDuration += durationMs;

          for (const range of scoreRanges) {
            if (score >= range.min && score <= range.max) {
              range.count++;
              break;
            }
          }

          return {
            student_user_id: student.user_id,
            student_name: student.name,
            status,
            violation_count: violationCount,
            score: Math.round(score),
            duration: formatDuration(attempt.created_at, attempt.attempted_at),
          };
        }

        return null;
      })
      .filter(Boolean);

    studentList.sort((a, b) => a.student_name.localeCompare(b.student_name));

    const averageDuration =
      alreadySubmitted > 0 ? formatDuration(totalDuration / alreadySubmitted) : null;

    const quizSummary = {
      quiz_id: quiz.id,
      study_material: quiz.study_material,
      strict: quiz.strict,
      description: quiz.description,
      class_id: quiz.class_id,
      teacher_id: quiz.teacher_id,
      start: quiz.start,
      end: quiz.end,
      teacher_name: quiz.teacherDetails?.name || null,
      class_name: quiz.classDetails?.class_name || null,
      courses_name: quiz.coursesIdDetails?.nama_mapel || null,
      courses_id: quiz.courses_id,
      total_questions: quiz.total_question,
      created_at: quiz.created_at,
      total_students: studentList.length,
      summary: {
        already_submitted: alreadySubmitted,
        still_working: stillWorking,
        not_started: notStarted,
        not_doing: notDoing,
        average_score:
          alreadySubmitted > 0 ? parseFloat((totalScore / alreadySubmitted).toFixed(2)) : null,
        highest_score: highestScore,
        lowest_score: lowestScore,
        average_duration: averageDuration,
      },
      score_distribution: scoreRanges,
      student_list: studentList,
    };

    res.status(200).json({
      quiz: quizSummary,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getAllQuizzes = async (req, res) => {
  try {
    // 🔹 Ambil semua quiz + info kelas (metadata)
    const quizzes = await Quizz.findAll({
      include: [
        {
          model: ClassModel,
          as: 'classDetails', // sesuai association di models
          attributes: ['id', 'class_name'],
        },
        {
          model: Courses,
          as: 'coursesIdDetails',
          attributes: ['nama_mapel'],
        },
        {
          model: Teachers,
          as: 'teacherDetails',
          attributes: ['name'],
        }
      ],
      order: [['created_at', 'ASC']],
    });

    if (!quizzes.length) {
      return res.status(404).json({ msg: 'No quizzes found' });
    }

    const quizIds = quizzes.map((q) => q.id);

    // 🔹 Ambil semua attempts + data siswa
    const attempts = await StudentQuizAttempt.findAll({
      where: { quiz_id: quizIds },
      include: [
        {
          model: Students,
          as: 'student', // alias sesuai association
          attributes: ['user_id', 'name'],
        },
      ],
    });

    // 🔹 Kelompokkan attempt per quiz
    const attemptsByQuiz = {};
    for (const att of attempts) {
      if (!attemptsByQuiz[att.quiz_id]) attemptsByQuiz[att.quiz_id] = [];
      attemptsByQuiz[att.quiz_id].push(att);
    }

    // 🔹 Olah summary per quiz
    const quizSummaries = quizzes.map((quiz) => {
      const quizAttempts = attemptsByQuiz[quiz.id] || [];

      let alreadySubmitted = 0;
      let stillWorking = 0;
      let notStarted = 0;
      let notDoing = 0;
      let totalScore = 0;
      let highestScore = null;
      let lowestScore = null;
      let totalDuration = 0;

      const scoreRanges = [
        { range: '0-50', min: 0, max: 50, count: 0 },
        { range: '51-70', min: 51, max: 70, count: 0 },
        { range: '71-85', min: 71, max: 85, count: 0 },
        { range: '86-100', min: 86, max: 100, count: 0 },
      ];

      const studentList = quizAttempts
        .map((attempt) => {
          const student = attempt.student;
          const status = attempt.status;
          const violationCount = attempt.violation_count || 0;
          if (status === 'belum-mengerjakan') {
            notStarted++;
            return {
              student_user_id: student.user_id,
              student_name: student.name,
              status,
              violation_count: violationCount,
              score: null,
              duration: null,
            };
          }

          if (status === 'sedang-mengerjakan') {
            stillWorking++;
            return {
              student_user_id: student.user_id,
              student_name: student.name,
              status,
              violation_count: violationCount,
              score: null,
              duration: null,
            };
          }

          if (status === 'tidak-mengerjakan') {
            notDoing++;
            return {
              student_user_id: student.user_id,
              student_name: student.name,
              status,
              violation_count: violationCount,
              score: null,
              duration: null,
            };
          }

          if (status === 'selesai') {
            alreadySubmitted++;
            const score = attempt.score;
            totalScore += parseFloat(score);
            highestScore = highestScore === null ? score : Math.max(highestScore, score);
            lowestScore = lowestScore === null ? score : Math.min(lowestScore, score);

            const durationMs = new Date(attempt.attempted_at) - new Date(attempt.created_at);
            totalDuration += durationMs;

            for (const range of scoreRanges) {
              if (score >= range.min && score <= range.max) {
                range.count++;
                break;
              }
            }

            return {
              student_user_id: student.user_id,
              student_name: student.name,
              status,
              violation_count: violationCount,
              score: Math.round(score),
              duration: formatDuration(attempt.created_at, attempt.attempted_at),
            };
          }

          return null;
        })
        .filter(Boolean);

      studentList.sort((a, b) => a.student_name.localeCompare(b.student_name));

      const averageDuration =
        alreadySubmitted > 0 ? formatDuration(totalDuration / alreadySubmitted) : null;

      return {
        quiz_id: quiz.id,
        study_material: quiz.study_material,
        description: quiz.description,
        class_id: quiz.class_id,
        teacher_id: quiz.teacher_id,
        start:quiz.start,
        teacher_name:quiz.teacherDetails?.name || null,
        end:quiz.end,
        class_name: quiz.classDetails?.class_name || null, // 🔥 tambah ini
        courses_name: quiz.coursesIdDetails?.nama_mapel || null, // 🔥 tambah ini
        courses_id: quiz.courses_id,
        total_questions: quiz.total_question,
        created_at: quiz.created_at,
        courses_id: quiz.courses_id,
        total_students: studentList.length,
        summary: {
          already_submitted: alreadySubmitted,
          still_working: stillWorking,
          not_started: notStarted,
          not_doing: notDoing,
          average_score:
            alreadySubmitted > 0 ? parseFloat((totalScore / alreadySubmitted).toFixed(2)) : null,
          highest_score: highestScore,
          lowest_score: lowestScore,
          average_duration: averageDuration,
        },
        score_distribution: scoreRanges,
        student_list: studentList,
      };
    });

    res.status(200).json({
      total_quizzes: quizzes.length,
      quizzes: quizSummaries,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
