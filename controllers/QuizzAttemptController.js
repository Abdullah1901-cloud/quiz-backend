import StudentQuizAttempt from '../models/studentQuizz/quizzAttemptModel.js';
import StudentAnswer from '../models/studentQuizz/studentAnswerModel.js';
import Students from '../models/StudentModel.js';
import Question from '../models/QuestionModel.js';
import Option from '../models/OptionModel.js';
import Quizz from '../models/QuizzModel.js';
import QuizAttemptAnswerTemp from '../models/studentQuizz/quizzAttemptAnswerTempModel.js';
import Badges from '../models/BadgeModel.js';
import StudentBadges from '../models/StudentBadgesModel.js';
import StudentPointsLog from '../models/StudentPointsLogModel.js';
import db from '../config/Database.js'; // sequelize instance
import { Op } from 'sequelize';
import Sequelize from 'sequelize';
import dayjs from 'dayjs';

function shuffleArray(array) {
  return array
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}
function getDurationMs(start, end) {
  return new Date(end) - new Date(start);
}
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

export async function updateStreak(student_user_id, transaction = null) {
  // Ambil streak terakhir
  const student = await Students.findOne({
    where: { user_id: student_user_id },
    attributes: ['streak_count', 'last_submission_date'],
    transaction,
    raw: true, // ambil plain object
  });

  if (!student) return 0;

  const today = dayjs().startOf('day');
  const last = student.last_submission_date
    ? dayjs(student.last_submission_date).startOf('day')
    : null;

  let newStreak = 1;

  if (last) {
    const diff = today.diff(last, 'day');
    if (diff === 0) {
      // sudah submit hari ini, streak tetap
      newStreak = student.streak_count;
    } else if (diff === 1) {
      // streak berlanjut
      newStreak = student.streak_count + 1;
    } else {
      // streak putus, tetap newStreak = 1
    }
  }

  // update streak dan last_submission_date langsung
  await Students.update(
    {
      streak_count: newStreak,
      last_submission_date: today.toDate(),
    },
    {
      where: { user_id: student_user_id },
      transaction,
    }
  );

  return newStreak;
}

// helper: award badge
export async function awardBadge(studentId, badgeName, transaction) {
  const badge = await Badges.findOne({ where: { name: badgeName } });
  if (!badge) return null;

  let studentBadge = await StudentBadges.findOne({
    where: { student_id: studentId, badges_id: badge.id },
    transaction,
  });

  if (studentBadge) {
    studentBadge.quantity += 1;
    await studentBadge.save({ transaction });
  } else {
    studentBadge = await StudentBadges.create(
      { student_id: studentId, badges_id: badge.id, quantity: 1 },
      { transaction }
    );
  }

  await StudentPointsLog.create(
    {
      student_id: studentId,
      points: badge.point_value,
      source: `badge: ${badge.name}`,
    },
    { transaction }
  );

  return {
    badgeId: badge.id,
    name: badge.name,
    description: badge.description,
    image_url: badge.image,
    points: badge.point_value,
    quantity: studentBadge.quantity,
  };
}

export const reportViolation = async (req, res) => {
  const uuid = req.params.uuid;
  const userId = req.session?.user?.user_id;
  const { awayStart, awayEnd, offline } = req.body;

  if (!awayStart || !awayEnd) {
    return res.status(400).json({ msg: 'awayStart and awayEnd are required' });
  }

  const t = await db.transaction();
  try {
    // Ambil attempt dengan lock
    const attempt = await StudentQuizAttempt.findOne({
      where: { uuid },
      include: [{ model: Quizz, as: 'quiz', attributes: ['strict'] }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!attempt) {
      await t.rollback();
      return res.status(404).json({ msg: 'Attempt not found' });
    }
    if (!attempt.quiz.strict) {
      await t.rollback();
      return res.status(200).json({ action: 'ignored', reason: 'strict_disabled' });
    }

    if (userId && attempt.student_user_id !== userId) {
      await t.rollback();
      return res.status(403).json({ msg: 'Forbidden' });
    }

    // skip jika sudah submitted
    if (attempt.attempted_at) {
      await t.rollback();
      return res.status(200).json({ action: 'skipped', reason: 'already_submitted' });
    }

    // parse times (terima number (ms) atau ISO string)
    const sMs = typeof awayStart === 'number' ? awayStart : new Date(awayStart).getTime();
    const eMs = typeof awayEnd === 'number' ? awayEnd : new Date(awayEnd).getTime();

    if (isNaN(sMs) || isNaN(eMs) || eMs <= sMs) {
      await t.rollback();
      return res.status(400).json({ msg: 'Invalid awayStart/awayEnd' });
    }

    const awaySec = Math.floor((eMs - sMs) / 1000);
    const currentViolations = attempt.violation_count || 0;

    // First-warning rule
    if (currentViolations === 0 && awaySec <= 120) {
      const updated = await attempt.update(
        {
          violation_count: currentViolations + 1,
        },
        { transaction: t }
      );
      await t.commit();
      return res.json({
        action: 'warning',
        message:
          'Peringatan: jangan tinggalkan tab lebih dari 2 menit. Jika terulang, waktu akan dikurangi.',
        away_seconds: awaySec,
        violation_count: updated.violation_count,
      });
    }

    // Determine action
    let action = 'penalty';
    let minutesReduce = 0;

    if (awaySec < 1 * 60) {
      minutesReduce = 5;
    } else if (awaySec < 5 * 60) {
      minutesReduce = 10;
    } else if (awaySec < 10 * 60) {
      minutesReduce = 15;
    } else {
      action = 'auto_submit';
    }

    // If violation_count + 1 > 5 -> auto submit
    if (currentViolations + 1 > 5) {
      action = 'auto_submit';
    }

    // If auto_submit decided
    if (action === 'auto_submit' && currentViolations === 5) {
      // Process submission (use existing processSubmission)
      const submissionResult = await processSubmission(attempt, { transaction: t });
      await attempt.update(
        { status: 'selesai', violation_count: currentViolations + 1, attempted_at: new Date() },
        { transaction: t }
      );
      await t.commit();
      return res.json({
        action: 'auto_submit',
        message: 'Kuis dikirim otomatis karena pelanggaran berulang',
        submission: submissionResult,
      });
    }
    if (action === 'auto_submit' && awaySec > 10 * 60) {
      // Process submission (use existing processSubmission)
      const submissionResult = await processSubmission(attempt, { transaction: t });
      await attempt.update(
        { status: 'selesai', violation_count: currentViolations + 1, attempted_at: new Date() },
        { transaction: t }
      );
      await t.commit();
      return res.json({
        action: 'auto_submit',
        message: 'Kuis dikirim otomatis karena waktu meninggalkan tab terlalu lama',
        submission: submissionResult,
      });
    }

    // Apply penalty: reduce end_time
    if (!attempt.end_time) {
      // fallback error
      await t.rollback();
      return res.status(500).json({ msg: 'Attempt has no end_time configured' });
    }

    const currentEndMs = new Date(attempt.end_time).getTime();
    const newEndMs = currentEndMs - minutesReduce * 60 * 1000;

    if (newEndMs <= Date.now()) {
      // new end_time already passed => auto submit
      const submissionResult = await processSubmission(attempt, { transaction: t });
      await attempt.update(
        { status: 'selesai', violation_count: currentViolations + 1, attempted_at: new Date() },
        { transaction: t }
      );
      await t.commit();
      return res.json({
        action: 'auto_submit',
        message: 'Kuis dikirim otomatis karena waktu sudah habis akibat pelanggaran',
        submission: submissionResult,
      });
    }

    // Update attempt with new end_time and increment violation count
    const updated = await attempt.update(
      {
        end_time: new Date(newEndMs),
        violation_count: currentViolations + 1,
      },
      { transaction: t }
    );

    await t.commit();

    return res.json({
      action: 'penalty',
      message: `Waktu dikurangi ${minutesReduce} menit`,
      minutes_reduced: minutesReduce,
      violation_count: updated.violation_count,
      new_end_time: updated.end_time,
    });
  } catch (err) {
    await t.rollback();
    console.error(err);
    return res.status(500).json({ msg: err.message });
  }
};

export const startQuizForStudent = async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      message: 'Mohon login terlebih dahulu',
    });
  }
  const quizId = req.params.id;
  const attempt = await StudentQuizAttempt.findOne({
    where: { student_user_id: req.session.user.user_id, quiz_id: quizId },
  });
  if (attempt && attempt.attempted_at) {
    return res.status(400).json({ message: 'Anda sudah menyelesaikan kuis ini!.' });
  }
  try {
    const quiz = await Quizz.findOne({
      where: {
        id: quizId,
        class_id: req.session.user.class_id,
        is_deleted: false,
        is_active: true,
      },
      attributes: ['id', 'study_material', 'description', 'duration', 'start', 'end'],
    });

    if (!quiz) {
      return res.status(404).json({ msg: 'Kuis tidak ditemukan' });
    }

    // Hitung end_time attempt
    const startTime = new Date();
    const quizEndTime = new Date(quiz.end);
    const maxEndTime = new Date(startTime.getTime() + quiz.duration * 60000);
    const finalEndTime = maxEndTime > quizEndTime ? quizEndTime : maxEndTime;

    // Buat attempt jika belum ada
    const [attempt, created] = await StudentQuizAttempt.findOrCreate({
      where: {
        student_user_id: req.session.user.user_id,
        quiz_id: quiz.id,
      },
      defaults: {
        student_user_id: req.session.user.user_id,
        quiz_id: quiz.id,
        score: 0,
        attempted_at: null,
        start_time: startTime,
        end_time: finalEndTime, // simpan end_time
      },
    });

    // Kalau attempt sudah ada tapi belum punya end_time, update
    if (!created && !attempt.start_time) {
      attempt.start_time = startTime;
      attempt.end_time = finalEndTime;
      attempt.created_at = new Date();
      attempt.status = 'sedang-mengerjakan';
      await attempt.save();
    }

    res.status(200).json({
      message: 'Kuis berhasil dimulai',
      quiz: {
        id: quiz.id,
        attempt_uuid: attempt.uuid,
      },
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getStudentQuiz = async (req, res) => {
  const student_user_id = req.session.user.user_id;
  const quizAttemptId = req.params.quizAttemptId;
  try {
    const quizAttempt = await StudentQuizAttempt.findOne({
      where: { uuid: quizAttemptId, student_user_id },
    });
    if (!quizAttempt) {
      return res.status(404).json({ msg: 'Kuis tidak ditemukan atau belum dimulai' });
    }
    const quiz = await Quizz.findOne({
      where: {
        id: quizAttempt.quiz_id,
      },
      attributes: ['id', 'study_material', 'description', 'duration', 'start', 'end', 'strict'],
      include: [
        {
          model: Question,
          as: 'questions',
          attributes: ['id', 'question_text', 'image', 'point'],
          include: [
            {
              model: Option,
              as: 'options',
              attributes: ['id', 'option_text', 'image'],
            },
          ],
        },
      ],
    });

    if (!quiz) {
      return res.status(404).json({ msg: 'Kuis tidak ditemukan' });
    }

    const shuffledQuestions = shuffleArray(quiz.questions).map((q) => {
      const shuffledOptions = shuffleArray(q.options);
      return {
        ...q.toJSON(),
        options: shuffledOptions,
      };
    });
    res.status(200).json({
      message: 'Kuis berhasil dimulai',
      quiz: {
        id: quiz.id,
        strict: quiz.strict,
        study_material: quiz.study_material,
        description: quiz.description,
        duration: quiz.duration,
        attempt_uuid: quizAttempt.uuid,
        start_time: quizAttempt.start_time,
        end_time: quizAttempt.end_time,
      },
      questions: shuffledQuestions,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getStudentQuizAttempt = async (req, res) => {
  const student_user_id = req.session.user.user_id;
  const quiz_id = req.params.quizId;
  try {
    const attempts = await StudentQuizAttempt.findAll({
      where: { student_user_id, quiz_id, status: 'selesai' },
      include: [
        {
          model: Quizz,
          as: 'quiz',
          where: { end: { [Op.lte]: new Date() } },
          include: [
            {
              model: Question,
              as: 'questions',
              include: [{ model: Option, as: 'options' }],
            },
          ],
        },
        {
          model: StudentAnswer,
          as: 'studentAnswers',
          include: [
            {
              model: Question,
              as: 'question',
            },
            {
              model: Option,
              as: 'option',
            },
          ],
        },
      ],
    });

    if (!attempts || attempts.length === 0) {
      return res.status(404).json({ msg: 'Kuis belum dikerjakan atau belum selesai' });
    }

    const formatDuration = (seconds) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (h > 0) {
        return `${String(h).padStart(2, '0')} Jam ${String(m).padStart(2, '0')} Menit ${String(
          s
        ).padStart(2, '0')} Detik`;
      }
      return `${String(m).padStart(2, '0')} Menit ${String(s).padStart(2, '0')} Detik`;
    };

    const result = attempts.map((attempt) => {
      const studentAnswers =
        attempt.student_answers || attempt.StudentAnswers || attempt.studentAnswers || [];

      // Buat map jawaban siswa untuk akses cepat berdasarkan question_id
      const answerMap = {};
      studentAnswers.forEach((ans) => {
        if (ans.question_id) {
          answerMap[ans.question_id] = ans.selected_option_id;
        }
      });
      const startedAt = attempt.created_at;
      const finishedAt = attempt.attempted_at;

      let durationSeconds = 0;
      if (finishedAt && startedAt) {
        durationSeconds = Math.floor((new Date(finishedAt) - new Date(startedAt)) / 1000);
      }

      // Total soal adalah jumlah soal di kuis
      const totalQuestions = attempt.quiz?.questions?.length || 0;

      // Hitung jawaban benar berdasarkan jawaban siswa dan opsi benar
      let correctAnswers = 0;

      // Susun daftar soal dengan opsi lengkap dan info jawaban siswa
      const questionsWithOptionsAndAnswer = (attempt.quiz?.questions || []).map((question) => {
        const studentSelectedOptionId = answerMap[question.id] || null;

        // Hitung apakah jawaban benar untuk soal ini
        const selectedOption = question.options.find((opt) => opt.id === studentSelectedOptionId);
        if (selectedOption?.is_correct) {
          correctAnswers++;
        }

        return {
          question_id: question.id,
          question_image: question.image,
          question_text: question.question_text,
          options: question.options.map((opt) => ({
            option_id: opt.id,
            option_image: opt.image,
            option_text: opt.option_text,
            is_correct: opt.is_correct,
            is_selected: opt.id === studentSelectedOptionId,
          })),
        };
      });

      return {
        quiz_id: attempt.quiz_id,
        study_material: attempt.quiz?.study_material,
        score: attempt.score,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_seconds: durationSeconds,
        duration_formatted: formatDuration(durationSeconds),
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        questions: questionsWithOptionsAndAnswer,
      };
    });

    res.status(200).json({ result: result });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
export const getStudentQuizAttempts = async (req, res) => {
  const student_user_id = req.session.user.user_id;
  const status = 'selesai';
  try {
    const attempts = await StudentQuizAttempt.findAll({
      where: { student_user_id, status },
      include: [
        {
          model: Quizz,
          as: 'quiz',
          where: { end: { [Op.lte]: new Date() } },
          include: [
            {
              model: Question,
              as: 'questions',
              include: [{ model: Option, as: 'options' }],
            },
          ],
        },
        {
          model: StudentAnswer,
          as: 'studentAnswers',
          include: [
            {
              model: Question,
              as: 'question',
            },
            {
              model: Option,
              as: 'option',
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });
    console.log(attempts);
    if (!attempts || attempts.length === 0) {
      return res.status(404).json({ msg: 'Belum ada kuis yang dikerjakan atau sudah selesai' });
    }

    const formatDuration = (seconds) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (h > 0) {
        return `${String(h).padStart(2, '0')} Jam ${String(m).padStart(2, '0')} Menit ${String(
          s
        ).padStart(2, '0')} Detik`;
      }
      return `${String(m).padStart(2, '0')} Menit ${String(s).padStart(2, '0')} Detik`;
    };

    const result = attempts.map((attempt) => {
      const studentAnswers =
        attempt.student_answers || attempt.StudentAnswers || attempt.studentAnswers || [];
      const startedAt = attempt.created_at;
      const finishedAt = attempt.attempted_at;

      let durationSeconds = 0;
      if (finishedAt && startedAt) {
        durationSeconds = Math.floor((new Date(finishedAt) - new Date(startedAt)) / 1000);
      }

      const totalQuestions = studentAnswers.length;
      const correctAnswers = studentAnswers.filter((ans) => ans.option?.is_correct).length;

      return {
        quiz_id: attempt.quiz_id,
        study_material: attempt.quiz?.study_material,
        images: attempt.quiz?.image,
        score: attempt.score,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_seconds: durationSeconds,
        duration_formatted: formatDuration(durationSeconds),
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
      };
    });

    res.status(200).json({ result: result });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Helper: format numeric score (optional)
function normalizeScore(n) {
  return Number.isFinite(n) ? parseFloat(Number(n).toFixed(2)) : 0;
}

/**
 * Proses submission (dipakai baik endpoint manual maupun cron)
 * - Ambil semua pertanyaan quiz
 * - Ambil semua temp answers untuk attempt
 * - Untuk tiap soal, bandingkan jawaban jika ada -> hitung skor
 * - Simpan StudentAnswer (final) untuk setiap soal (jawaban null => selected_option_id null)
 * - Update StudentQuizAttempt.score dan attempted_at
 * - Hapus temp answers untuk attempt
 *
 * RETURN: { totalScore, totalQuestions, correctCount }
 */
export async function processSubmission(attempt, options = {}) {
  const transaction = options.transaction || null;

  if (attempt.attempted_at) {
    return { skipped: true, reason: 'already_submitted' };
  }
  if (!attempt.start_time) {
    return { skipped: true, reason: 'attempt_not_started' };
  }
  const quiz = await Quizz.findByPk(attempt.quiz_id, { transaction });
  if (!quiz) throw new Error('Quiz not found for attempt');

  const questions = await Question.findAll({
    where: { quiz_id: quiz.id },
    attributes: ['id', 'point'],
    raw: true,
    transaction,
  });

  const tempAnswers = await QuizAttemptAnswerTemp.findAll({
    where: { attempt_uuid: attempt.uuid },
    raw: true,
    transaction,
  });

  const tempByQuestion = {};
  for (const t of tempAnswers) {
    tempByQuestion[t.question_id] = t;
  }

  const finalAnswers = [];
  let totalScore = 0;
  let correctCount = 0;

  for (const q of questions) {
    const temp = tempByQuestion[q.id];
    const selected_option_id = temp ? temp.option_id : null;

    let isCorrect = false;
    if (selected_option_id) {
      const opt = await Option.findByPk(selected_option_id, { transaction });
      if (opt && opt.is_correct) isCorrect = true;
    }

    if (isCorrect) {
      totalScore += parseFloat(q.point || 0);
      correctCount++;
    }

    finalAnswers.push({
      attempt_uuid: attempt.uuid,
      question_id: q.id,
      selected_option_id: selected_option_id || null,
    });
  }

  if (finalAnswers.length > 0) {
    await StudentAnswer.bulkCreate(finalAnswers, { transaction });
  }

  const normalizedTotalScore = normalizeScore(totalScore);
  await StudentQuizAttempt.update(
    { score: normalizedTotalScore, attempted_at: new Date(), status: 'selesai' },
    { where: { uuid: attempt.uuid }, transaction }
  );

  const refreshed = await StudentQuizAttempt.findOne({
    where: { uuid: attempt.uuid },
    attributes: ['created_at', 'attempted_at', 'quiz_id'],
    transaction,
  });
  const durationMs = getDurationMs(refreshed.created_at, refreshed.attempted_at);
  const duration = formatDuration(refreshed.created_at, refreshed.attempted_at);

  await QuizAttemptAnswerTemp.destroy({ where: { attempt_uuid: attempt.uuid }, transaction });

  // ========================
  // BADGE CHECK
  // ========================
  let earnedBadges = [];

  // First Try
  const totalAttempts = await StudentQuizAttempt.count({
    where: { student_user_id: attempt.student_user_id, status: 'selesai' },
    transaction,
  });
  if (totalAttempts === 1) {
    const badge = await awardBadge(attempt.student_user_id, 'First Try', transaction);
    if (badge) earnedBadges.push(badge);
  }

  // Perfect Score
  if (normalizedTotalScore === 100) {
    const badge = await awardBadge(attempt.student_user_id, 'Perfect Score', transaction);
    if (badge) earnedBadges.push(badge);
  }

  // Fast Thinker
  if (normalizedTotalScore >= 80 && durationMs < 5 * 60 * 1000) {
    const badge = await awardBadge(attempt.student_user_id, 'Fast Thinker', transaction);
    if (badge) earnedBadges.push(badge);
  }

  // Active Learner
  const distinctQuizzes = await StudentQuizAttempt.count({
    distinct: true,
    col: 'quiz_id',
    where: { student_user_id: attempt.student_user_id, status: 'sudah-mengerjakan' },
    transaction,
  });
  if (distinctQuizzes === 10) {
    const badge = await awardBadge(attempt.student_user_id, 'Active Learner', transaction);
    if (badge) earnedBadges.push(badge);
  }

  // Update streak real-time
  const streak = await updateStreak(attempt.student_user_id, transaction);

  // Badge berdasarkan streak
  if (streak === 7) {
    const badge = await awardBadge(attempt.student_user_id, 'Consistency is Key', transaction);
    if (badge) earnedBadges.push(badge);
  }
  if (streak === 30) {
    const badge = await awardBadge(attempt.student_user_id, '30 Days in a Row', transaction);
    if (badge) earnedBadges.push(badge);
  }

  // Top Ranker → diberikan via scheduled job mingguan
  // Level up logic
  let levelUpInfo = null; // default null, hanya dikirim jika naik level

  const student = await Students.findOne({
    where: { user_id: attempt.student_user_id },
    transaction,
  });

  if (student) {
    const prevLevel = student.level;
    const pure_point = await StudentQuizAttempt.sum('score', {
      where: {
        student_user_id: attempt.student_user_id,
        status: 'selesai',
      },
      transaction,
    });
    const badges = await StudentBadges.findAll({
      where: {
        student_id: attempt.student_user_id,
      },
      include: [
        {
          model: Badges,
          as: 'badgeDetails',
          attributes: ['point_value'],
        },
      ],
      transaction,
    });
    const badge = badges.map((sb) => ({
      ...sb.badgeDetails?.toJSON(),
      badge_point: sb.badgeDetails?.point_value * sb.quantity || 0,
    }));
    const badge_point = badge.reduce((sum, b) => sum + b.badge_point, 0);
    const newLevel = Math.floor((pure_point + badge_point) / 1000) + 1; // Tambah +1

    if (newLevel > prevLevel) {
      student.level = newLevel;
      await student.save({ transaction });

      levelUpInfo = {
        previousLevel: prevLevel,
        newLevel: newLevel,
        message: `Selamat! Level Anda naik dari ${prevLevel} → ${newLevel}`,
      };

      console.log(
        `[Level Up] Student ${student.user_id} naik level dari ${prevLevel} → ${newLevel}`
      );
    }
  }
  await StudentPointsLog.create(
    {
      student_id: attempt.student_user_id,
      points: normalizedTotalScore,
      source: `quiz: ${refreshed.quiz_id}`,
    },
    { transaction }
  );
  return {
    skipped: false,
    totalScore: normalizedTotalScore,
    totalQuestions: questions.length,
    correctCount,
    duration,
    earnedBadges, // kirim ke FE
    levelUpInfo, // null jika tidak naik, atau object jika naik
  };
}

/* ========== Endpoints ========== */

/**
 * POST /api/quiz/attempts/temp-save
 * Body: { attempt_id, question_id, option_id }
 * Upsert jawaban sementara
 */
export const saveTempAnswer = async (req, res) => {
  try {
    const { attempt_uuid, question_id, option_id } = req.body;
    const student_user_id = req.session?.user?.user_id;

    if (!attempt_uuid || !question_id) {
      return res.status(400).json({ msg: 'attempt_uuid and question_id are required' });
    }

    // Optional: verify attempt belongs to session user
    const attempt = await StudentQuizAttempt.findByPk(attempt_uuid, { raw: true });
    if (!attempt) return res.status(404).json({ msg: 'Attempt not found' });
    if (student_user_id && attempt.student_user_id !== student_user_id) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    // Upsert: gunakan upsert (supported oleh Sequelize)
    await QuizAttemptAnswerTemp.upsert({
      attempt_uuid,
      question_id,
      option_id: option_id || null,
    });

    return res.json({ msg: 'Jawaban sementara tersimpan' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: err.message });
  }
};

/**
 * GET /api/quiz/attempts/:attemptId/temp
 * Ambil semua jawaban sementara untuk attempt (dipakai saat reload halaman)
 */
export const getTempAnswers = async (req, res) => {
  try {
    const { uuid } = req.params;
    const student_user_id = req.session?.user?.user_id;

    const attempt = await StudentQuizAttempt.findByPk(uuid, { raw: true });
    if (!attempt) return res.status(404).json({ msg: 'Attempt not found' });
    if (student_user_id && attempt.student_user_id !== student_user_id) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    const tempAnswers = await QuizAttemptAnswerTemp.findAll({
      where: { attempt_uuid: uuid },
      raw: true,
    });

    res.json({ attempt, tempAnswers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};

/**
 * POST /api/quiz/attempts/:attemptId/submit
 * Final submit by user (manual) - will call processSubmission
 * Body optional: { force: true } (if you want to force submit even if already attempted)
 */
export const submitFinalAnswers = async (req, res) => {
  const t = await db.transaction();
  try {
    const { uuid } = req.params;
    const { force } = req.body;
    const student_user_id = req.session?.user?.user_id;

    const attempt = await StudentQuizAttempt.findByPk(uuid, { transaction: t });
    if (!attempt) {
      await t.rollback();
      return res.status(404).json({ msg: 'Attempt not found' });
    }
    if (student_user_id && attempt.student_user_id !== student_user_id) {
      await t.rollback();
      return res.status(403).json({ msg: 'Forbidden' });
    }

    // if already submitted and not forcing -> reject
    if (attempt.attempted_at && !force) {
      await t.rollback();
      return res.status(400).json({ msg: 'Attempt already submitted' });
    }

    const result = await processSubmission(attempt, { transaction: t });
    await t.commit();

    if (result.skipped) {
      return res.status(200).json({ msg: 'Skipped', reason: result.reason });
    }
    console.log('Duration', result.duration);
    return res.status(200).json({
      msg: 'Quiz submitted',
      score: result.totalScore,
      correct: result.correctCount,
      duration: result.duration,
      earnedBadges: result.earnedBadges,
      levelUpInfo: result.levelUpInfo,
    });
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};

export const deleteStudentQuizAttempts = async (req, res) => {
  const t = await db.transaction();
  const student_user_id = req.params.studentUserId;
  const quiz_id = req.params.quizId;
  try {
    const student = await Students.findOne({ where: { user_id: student_user_id } });
    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
    }
    const deleted = await StudentQuizAttempt.findOne({
      where: { student_user_id, quiz_id },
      include: [{ model: StudentAnswer, as: 'studentAnswers' }],
      transaction: t,
    });
    if (!deleted) {
      return res.status(404).json({ msg: 'No attempts found to delete' });
    }
    if (deleted.status === 'selesai') {
      await StudentAnswer.destroy({ where: { attempt_uuid: deleted.uuid }, transaction: t });
      await StudentPointsLog.destroy({
        where: {
          student_id: deleted.student_user_id,
          source: {
            [Op.or]: [`quiz: ${quiz_id}`, `recalc_quiz: ${quiz_id}`],
          },
        },
        transaction: t,
      });
      await Students.update(
        { pure_point: Sequelize.literal(`pure_point - ${deleted.score}`) },
        { where: { user_id: student_user_id }, transaction: t }
      );
      await StudentQuizAttempt.update(
        {
          score: 0,
          attempted_at: null,
          created_at: null,
          start_time: null,
          violation_count: 0,
          status: 'tidak-mengerjakan',
        },
        { where: { uuid: deleted.uuid }, transaction: t }
      );
    } else {
      return res
        .status(400)
        .json({ msg: 'Tidak dapat dihapus karena siswa tidak mengerjakan kuis ini' });
    }
    await t.commit();
    res.status(200).json({ message: 'Percobaan siswa berhasil dihapus' });
  } catch (err) {
    await t.rollback();
    console.error(err);
    return res.status(500).json({ msg: err.message });
  }
};
