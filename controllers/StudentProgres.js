// controllers/progressController.js
import Students from '../models/StudentModel.js';
import Classes from '../models/ClassModel.js';
import Quizz from '../models/QuizzModel.js';
import Courses from '../models/CourseModel.js';
import StudentQuizAttempt from '../models/studentQuizz/quizzAttemptModel.js';

function getWeekOfMonth(date) {
  if(!date) return null;
  const d = new Date(date);
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  return Math.ceil((d.getDate() + firstDay.getDay()) / 7);
}

// Helper untuk dapatkan bulan (1-12)
function getMonth(date) {
  return new Date(date).getMonth() + 1;
}

// 🔹 1. Progress individu siswa
export const getStudentProgress = async (req, res) => {
  try {
    const { id } = req.params; // user_id siswa
    const student = await Students.findOne({
      where: { user_id: id },
      include: [
        {
          model: StudentQuizAttempt,
          as: 'attempts',
          attributes: ['attempted_at', 'status', 'score'],
          include: [
            {
              model: Quizz,
              as: 'quiz',
              attributes: ['id', 'study_material', 'start', 'end', 'class_id', 'courses_id'],
              include: [
                {
                  model: Courses,
                  as: 'coursesIdDetails',
                  attributes: ['nama_mapel'],
                },
              ],
            },
          ],
        },
        {
          model: Classes,
          as: 'wali_kelas',
          attributes: ['id', 'class_name'],
        },
      ],
      order: [[{ model: StudentQuizAttempt, as: 'attempts' }, 'attempted_at', 'ASC']],
    });
    if (!student) return res.status(404).json({ msg: 'Siswa tidak ditemukan' });
    // Hitung rata-rata skor kuis
    const attempts = student.attempts || [];
    const finishedAttempts = attempts.filter((at) => at.status === 'selesai');
    const unfinishedAttempts = attempts.filter((at) => at.status === 'tidak-mengerjakan');
    const stillWorkingAttempts = attempts.filter((at) => at.status === 'sedang-mengerjakan');
    const unstartedAttempts = attempts.filter((at) => at.status === 'belum-mengerjakan');
    const totalScore = finishedAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0);
    const avgScore = finishedAttempts.length > 0 ? totalScore / finishedAttempts.length : 0;

    // Hitung minggu ke berapa setiap quiz selesai, hanya jika punya tanggal start valid
    const weekNumbers = finishedAttempts
      .map((at) => getWeekOfMonth(at.quiz?.start))
      .filter((w) => Number.isFinite(w) && w > 0);

    // Pastikan ada nilai valid, default = 1
    const maxWeek = weekNumbers.length > 0 ? Math.max(...weekNumbers) : 1;

    // Buat array dengan panjang aman
    const weeklyStats = Array(maxWeek).fill(null);

    for (let week = 1; week <= maxWeek; week++) {
      const weekAttempts = finishedAttempts.filter((at) => getWeekOfMonth(at.quiz?.start) === week);

      if (weekAttempts.length > 0) {
        const total = weekAttempts.reduce((sum, at) => sum + (at.score || 0), 0);
        weeklyStats[week - 1] = {
          week: `Minggu ${week}`,
          avg: total / weekAttempts.length,
          count: weekAttempts.length,
        };
      } else {
        weeklyStats[week - 1] = {
          week: `Minggu ${week}`,
          avg: null,
          count: 0,
        };
      }
    }

    // === Monthly stats (Jan–Dec) ===
    const monthlyStats = Array(12).fill(null);
    for (let month = 1; month <= 12; month++) {
      const monthAttempts = finishedAttempts.filter((at) => getMonth(at.quiz?.start) === month);
      if (monthAttempts.length > 0) {
        const total = monthAttempts.reduce((sum, at) => sum + (at.score || 0), 0);
        monthlyStats[month - 1] = {
          avg: total / monthAttempts.length,
          count: monthAttempts.length,
        };
      } else {
        monthlyStats[month - 1] = { avg: null, count: 0 };
      }
    }

    // === Average per course ===
    // === Average per course ===
    const courseStats = {};
    finishedAttempts.forEach((at) => {
      const courseName = at.quiz?.coursesIdDetails?.nama_mapel || 'Unknown';
      if (!courseStats[courseName]) {
        courseStats[courseName] = { total: 0, count: 0 };
      }
      courseStats[courseName].total += parseFloat(at.score) || 0;
      courseStats[courseName].count += 1;
    });

    const avgPerCourse = Object.keys(courseStats).map((courseName) => ({
      course: courseName,
      avg:
        courseStats[courseName].count > 0
          ? courseStats[courseName].total / courseStats[courseName].count
          : 0,
      count: courseStats[courseName].count,
    }));

    // 🔹 Tambahkan nama_mapel langsung ke setiap attempt
    const attemptsWithCourseName = (student.attempts || []).map((at) => {
      const nama_mapel = at.quiz?.coursesIdDetails?.nama_mapel || null;
      const course_id = at.quiz?.courses_id || null;
      const study_material = at.quiz?.study_material || null;
      return {
        ...at.toJSON(),
        nama_mapel,
        course_id,
        study_material,
      };
    });

    // Siapkan hasil yang ingin dikirim
    const result = {
      user_id: student.user_id,
      name: student.name,
      totalQuizzes: attempts.length,
      status: [unfinishedAttempts.length, finishedAttempts.length, unstartedAttempts.length],
      class_id: student.class_id,
      class_name: student.wali_kelas?.class_name || null,
      avgScore: avgScore,
      weeklyStats,
      monthlyStats,
      avgPerCourse,
      attempts: attemptsWithCourseName, // 🔹 sudah berisi nama_mapel langsung
    };

    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 2. Progress keseluruhan siswa
export const getAllStudentsProgress = async (req, res) => {
  try {
    const response = await Students.findAll({
      include: [
        {
          model: StudentQuizAttempt,
          as: 'attempts',
          attributes: ['score', 'quiz_id', 'status'],
        },
        {
          model: Classes,
          as: 'wali_kelas',
          attributes: ['id', 'class_name'],
        },
      ],
      order: [['name', 'ASC']],
    });

    const result = response.map((r) => {
      // Filter hanya attempt yang statusnya selesai
      const finishedAttempts = r.attempts.filter((at) => at.status === 'selesai');
      const unfinishedAttempts = r.attempts.filter((at) => at.status === 'tidak-mengerjakan');
      const stillWorkingAttempts = r.attempts.filter((at) => at.status === 'sedang-mengerjakan');
      const unstartedAttempts = r.attempts.filter((at) => at.status === 'belum-mengerjakan');
      const allScores = finishedAttempts.map((at) => parseFloat(at.score));
      const avg = allScores.length
        ? parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
        : 0;

      return {
        student_id: r.user_id,
        name: r.name,
        class_id: r.class_id,
        class_name: r.wali_kelas?.class_name || null,
        totalUnfinishedQuizzes: unfinishedAttempts.length,
        totalFinishedQuizzes: finishedAttempts.length,
        totalStillWorkingQuizzes: stillWorkingAttempts.length,
        totalUnstartedQuizzes: unstartedAttempts.length,
        average_score: avg,
        total_quizzes: allScores.length, // 0 jika tidak ada attempt selesai
      };
    });
    res.json({ total_student: response.length, result: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 3. Progress per kelas
export const getClassesProgress = async (req, res) => {
  try {
    const classes = await Classes.findAll({
      include: [
        {
          model: Students,
          as: 'students',
          include: [
            {
              model: StudentQuizAttempt,
              as: 'attempts',
              attributes: ['score', 'status'],
              include: [
                {
                  model: Quizz,
                  as: 'quiz',
                  attributes: ['id', 'study_material', 'start', 'end', 'class_id', 'courses_id'],
                },
              ],
            },
          ],
        },
      ],
    });

    const result = classes.map((c) => {
      // Ambil semua quiz dari setiap attempt siswa
      const allQuizzes = c.students.flatMap((stu) => stu.attempts.map((at) => at.quiz));
      // Ambil quiz unik berdasarkan id
      const uniqueQuizIds = [...new Set(allQuizzes.map((q) => q.id))];
      const total_quizzes = uniqueQuizIds.length;

      const finishedAttempts = c.students.flatMap((stu) =>
        stu.attempts.filter((at) => at.status === 'selesai')
      );
      const unfinishedAttempts = c.students.flatMap((stu) =>
        stu.attempts.filter((at) => at.status === 'tidak-mengerjakan')
      );
      const stillWorkingAttempts = c.students.flatMap((stu) =>
        stu.attempts.filter((at) => at.status === 'sedang-mengerjakan')
      );
      const unstartedAttempts = c.students.flatMap((stu) =>
        stu.attempts.filter((at) => at.status === 'belum-mengerjakan')
      );
      const allScores = finishedAttempts.map((at) => parseFloat(at.score));
      const avg = allScores.length
        ? parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
        : 0;

      return {
        class_id: c.id,
        class_name: c.class_name,
        totalUnfinishedQuizzes: unfinishedAttempts.length,
        totalFinishedQuizzes: finishedAttempts.length,
        totalStillWorkingQuizzes: stillWorkingAttempts.length,
        totalUnstartedQuizzes: unstartedAttempts.length,
        total_quizzes: total_quizzes,
        student_count: c.students.length,
        average_score: avg,
        total_attempts: c.students.reduce((sum, stu) => sum + stu.attempts.length, 0), // jumlah seluruh percobaan
      };
    });

    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

export const getClassProgress = async (req, res) => {
  try {
    const id = req.params.id;
    const response = await Classes.findOne({
      where: {
        id: id,
      },
      include: {
        model: Students,
        as: 'students',
        include: [
          {
            model: StudentQuizAttempt,
            as: 'attempts',
            attributes: ['score', 'status'], // tambahkan status
            include: [
              {
                model: Quizz,
                as: 'quiz',
                attributes: ['id', 'study_material', 'start', 'end', 'class_id', 'courses_id'],
                where: {
                  class_id: id,
                },
              },
            ],
          },
        ],
      },
    });
    if (!response) {
      return res.status(404).json({
        message: 'Data tidak ditemukan',
      });
    }
    const result = response.students.map((c) => {
      // Filter hanya attempt yang statusnya selesai
      const finishedAttempts = c.attempts.filter((at) => at.status === 'selesai');
      const unfinishedAttempts = c.attempts.filter((at) => at.status === 'tidak-mengerjakan');
      const stillWorkingAttempts = c.attempts.filter((at) => at.status === 'sedang-mengerjakan');
      const unstartedAttempts = c.attempts.filter((at) => at.status === 'belum-mengerjakan');
      const allScores = finishedAttempts.map((at) => parseFloat(at.score));
      const avg = allScores.length
        ? parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
        : 0;

      return {
        student_id: c.user_id,
        name: c.name,
        class_id: c.class_id,
        average_score: avg,
        totalUnfinishedQuizzes: unfinishedAttempts.length,
        totalFinishedQuizzes: finishedAttempts.length,
        totalStillWorkingQuizzes: stillWorkingAttempts.length,
        totalUnstartedQuizzes: unstartedAttempts.length,
        total_quizzes: c.attempts.length, // 0 jika tidak ada attempt selesai
      };
    });
    res.json({ result: result, total_student: response.students.length });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: 'Internal Server Error',
    });
  }
};
