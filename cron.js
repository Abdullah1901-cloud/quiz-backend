// cron.js
import cron from 'node-cron';
import { Op, fn, col, where } from 'sequelize';
import Quiz from './models/QuizzModel.js';
import StudentQuizAttempt from './models/studentQuizz/quizzAttemptModel.js';
import StudentPointsLog from './models/StudentPointsLogModel.js';
import Students from './models/StudentModel.js';
import Classes from './models/ClassModel.js';
import db from './config/Database.js';
import { processSubmission, awardBadge } from './controllers/QuizzAttemptController.js';
import dayjs from 'dayjs';

// =======================
// 1️⃣ Task tiap menit
// =======================
cron.schedule('* * * * *', async () => {
  const now = dayjs().format('YYYY-MM-DD HH:mm');
  const t = await db.transaction();
  try {
    // Aktifkan kuis
    await Quiz.update(
      { is_active: true },
      {
        where: {
          is_active: false,
          [Op.and]: [
            where(fn('DATE_FORMAT', col('start'), '%Y-%m-%d %H:%i'), '<=', now),
            where(fn('DATE_FORMAT', col('end'), '%Y-%m-%d %H:%i'), '>=', now),
          ],
        },
        transaction: t,
      }
    );

    // 🔹 Nonaktifkan kuis
    await Quiz.update(
      { is_active: false },
      {
        where: {
          is_active: true,
          [Op.and]: [where(fn('DATE_FORMAT', col('end'), '%Y-%m-%d %H:%i'), '<=', now)],
        },
        transaction: t,
      }
    );

    // 🔹 Ambil kuis yang aktif dan sudah waktunya dimulai
    const activeQuizzes = await Quiz.findAll({
      where: {
        is_active: true,
        [Op.and]: [
          where(fn('DATE_FORMAT', col('start'), '%Y-%m-%d %H:%i'), '<=', now),
          where(fn('DATE_FORMAT', col('end'), '%Y-%m-%d %H:%i'), '>=', now),
        ],
      },
      include: [
        {
          model: Classes,
          as: 'classDetails',
          include: [{ model: Students, as: 'students', attributes: ['user_id'] }],
        },
      ],
      transaction: t,
    });

    for (const quiz of activeQuizzes) {
      const students = quiz.classDetails?.students || [];
      for (const student of students) {
        // 🔹 Cek apakah attempt sudah ada
        const existing = await StudentQuizAttempt.findOne({
          where: { quiz_id: quiz.id, student_user_id: student.user_id },
          transaction: t,
        });

        if (!existing) {
          await StudentQuizAttempt.create(
            {
              quiz_id: quiz.id,
              student_user_id: student.user_id,
              status: 'belum-mengerjakan',
              end_time: quiz.end,
            },
            { transaction: t }
          );
          console.log(`[Cron] Created attempt for ${student.user_id} in quiz ${quiz.id}`);
        }
      }
    }

    // 3. Auto submit attempt yang sudah waktunya habis
    const expiredAttempts = await StudentQuizAttempt.findAll({
      where: {
        attempted_at: null,
        [Op.and]: [
          where(fn('DATE_FORMAT', col('end_time'), '%Y-%m-%d %H:%i'), '=', now),
        ],
      },
      transaction: t,
    });

    for (const attempt of expiredAttempts) {
      const result = await processSubmission(attempt, { transaction: t });
      console.log(result);
      if (result.skipped && result.reason === 'attempt_not_started') {
        await StudentQuizAttempt.update(
          { status: 'tidak-mengerjakan' },
          { where: { uuid: attempt.uuid }, transaction: t }
        );
        console.log(`[Cron] Marked as not done attempt ${attempt.uuid}`);
        continue;
      }
      console.log(`[Cron] Auto submitted attempt ${attempt.uuid}`);
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    console.error('[Cron Error - minute tasks]', err);
  }
});

// =======================
// 2️⃣ Reset streak tiap jam 00:00
// =======================
cron.schedule('00 00 * * *', async () => {
  const now = new Date();
  console.log(`[Cron] Checking streaks at midnight ${now.toISOString()}`);
  const t = await db.transaction();
  try {
    const students = await Students.findAll({
      where: {
        streak_count: { [Op.gt]: 0 },
        last_submission_date: { [Op.ne]: null },
      },
      transaction: t,
    });

    for (const student of students) {
      const lastDate = dayjs(student.last_submission_date).startOf('day');
      const today = dayjs().startOf('day');
      const diff = today.diff(lastDate, 'day');

      if (diff > 1) {
        student.streak_count = 0;
        student.last_submission_date = null;
        await student.save({ transaction: t });
        console.log(`[Cron] Reset streak for student ${student.user_id}`);
      }
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    console.error('[Cron Error - streak reset]', err);
  }
});

// =======================
// 3️⃣ Award Top Ranker tiap Sabtu jam 23:59
// =======================
cron.schedule('59 23 * * 6', async () => {
  const now = new Date();
  console.log('[Cron] Awarding Top Rankers...');
  const t = await db.transaction();
  try {
    const day = now.getDay(); // 6 = Sabtu
    const monday = new Date(now);
    monday.setDate(now.getDate() - 6); // Senin minggu ini
    monday.setHours(0, 0, 0, 0);

    const saturday = new Date(now);
    saturday.setHours(23, 59, 59, 999);

    const leaderboard = await StudentPointsLog.findAll({
      attributes: ['student_id', [db.fn('SUM', db.col('points')), 'total_points']],
      where: {
        created_at: { [Op.between]: [monday, saturday] },
      },
      group: ['student_id'],
      order: [[db.fn('SUM', db.col('points')), 'DESC']],
      limit: 3,
      transaction: t,
    });

    for (let i = 0; i < leaderboard.length; i++) {
      const student = leaderboard[i];
      const rank = i + 1;

      let badgeName;
      if (rank === 1) badgeName = 'Top Rank 1';
      else if (rank === 2) badgeName = 'Top Rank 2';
      else badgeName = 'Top Rank 3';

      await awardBadge(student.student_id, badgeName, t);
      console.log(`[Cron] Awarded ${badgeName} to student ${student.student_id}`);
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    console.error('[Cron Error - Top Ranker]', err);
  }
});
