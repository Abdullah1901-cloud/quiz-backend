import Student from '../models/StudentModel.js';
import StudentBadges from '../models/StudentBadgesModel.js';
import Users from '../models/UserModel.js';
import argon2 from 'argon2';
import StudentPointsLog from '../models/StudentPointsLogModel.js';
import StudentQuizAttempt from '../models/studentQuizz/quizzAttemptModel.js';
import Badges from '../models/BadgeModel.js';
import Class from '../models/ClassModel.js';
import Teachers from '../models/TeacherModel.js';
import { fn, col, literal, Op } from 'sequelize';
import path from 'path';
import fs from 'fs';
import db from '../config/Database.js';
import { logActivity } from '../helpers/logActivity.js';
import Sequelize from 'sequelize';

export const leaderboardStudent = async (req, res) => {
  try {
    const { time_filter, filter_by, filter_value } = req.query;
    let wherePoints = {};
    let whereStudent = { is_active: true };
    let whereClass = {};
    const now = new Date();

    // weekly
    if (time_filter === 'weekly') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - 6);
      monday.setHours(0, 0, 0, 0);

      const saturday = new Date(now);
      saturday.setHours(23, 59, 59, 999);

      wherePoints.created_at = { [Op.between]: [monday, saturday] };
    }

    // monthly
    if (time_filter === 'monthly') {
      const now2 = new Date();
      const firstDay = new Date(now2.getFullYear(), now2.getMonth(), 1);
      const lastDay = new Date(now2.getFullYear(), now2.getMonth() + 1, 0);
      firstDay.setHours(0, 0, 0, 0);
      lastDay.setHours(23, 59, 59, 999);

      wherePoints.created_at = { [Op.between]: [firstDay, lastDay] };
    }

    // filter kelas / tingkat
    if (filter_by === 'tingkat_kelas' && filter_value) {
      whereClass.class_name = { [Op.like]: `${filter_value}%` };
    }
    if (filter_by === 'kelas' && filter_value) {
      whereClass.class_name = filter_value;
    }

    const leaderboard = await Student.findAll({
      attributes: [
        'id',
        'user_id',
        'name',
        'photo',
        'level',
        'streak_count',

        // badge_point via subquery
        [
          literal(`(
        SELECT COALESCE(SUM(sb.quantity * b.point_value), 0)
        FROM student_badges sb
        LEFT JOIN badges b ON sb.badges_id = b.id
        WHERE sb.student_id = students.user_id
      )`),
          'badge_point',
        ],

        // pure_point via subquery
        [
          literal(`(
    SELECT COALESCE(SUM(sqa.score), 0)
    FROM student_quiz_attempts sqa
    WHERE sqa.student_user_id = students.user_id
  )`),
          'pure_point',
        ],

        [
          Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('pointsLog.points')), 0),
          'total_points',
        ],
      ],
      where: whereStudent,
      include: [
        {
          model: Class,
          as: 'wali_kelas',
          attributes: ['class_name'],
          where: Object.keys(whereClass).length ? whereClass : undefined,
        },
        {
          model: StudentPointsLog,
          as: 'pointsLog',
          attributes: [],
          required: false,
          where: Object.keys(wherePoints).length ? wherePoints : undefined,
        },
      ],
      group: ['students.id', 'wali_kelas.id'],
      order: [
        [literal('total_points'), 'DESC'],
        ['pure_point', 'DESC'],
        [literal('badge_point'), 'DESC'],
        ['streak_count', 'DESC'],
        ['id', 'ASC'],
      ],
    });

    res.status(200).json({
      message: `Leaderboard ${filter_by || 'overall'}`,
      filter_by,
      filter_value,
      students: leaderboard,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const getStudent = async (req, res) => {
  try {
    const response = await Student.findAll({
      attributes: [
        'id',
        'user_id',
        'name',
        'photo',
        'level',
        'is_active',
        'class_id',
        'streak_count',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
        'updated_by_role',

        // badge_point via subquery
        [
          literal(`(
            SELECT COALESCE(SUM(sb.quantity * b.point_value), 0)
            FROM student_badges sb
            LEFT JOIN badges b ON sb.badges_id = b.id
            WHERE sb.student_id = students.user_id
          )`),
          'badge_point',
        ],

        // pure_point via subquery
        [
          literal(`(
            SELECT COALESCE(SUM(sqa.score), 0)
            FROM student_quiz_attempts sqa
            WHERE sqa.student_user_id = students.user_id
          )`),
          'pure_point',
        ],

        // total_points via subquery
        [
          literal(`(
            SELECT COALESCE(SUM(spl.points), 0)
            FROM student_points_log spl
            WHERE spl.student_id = students.user_id
          )`),
          'total_points',
        ],
      ],
      include: [
        {
          model: Class,
          as: 'wali_kelas', // dari students.class_id
          attributes: ['wali_kelas', 'class_name'],
          include: [
            {
              model: Teachers,
              as: 'waliKelasGuru', // dari classes.wali_kelas
              attributes: ['name'],
            },
          ],
        },
      ],
    });

    res.status(200).json({ message: 'Data ditemukan', student: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const getStudentById = async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      message: 'Mohon login terlebih dahulu',
    });
  }
  try {
    const response = await Student.findOne({
      where: {
        user_id: req.session.user.user_id,
      },
      attributes: {
        include: ['id', 'user_id', 'name', 'photo', 'level', 'streak_count'],
      },
      include: [
        {
          model: Class,
          as: 'wali_kelas',
          attributes: ['class_name'],
        },
        {
          model: StudentBadges,
          as: 'badges',
          required: false,
          attributes: ['id', 'badges_id', 'earned_at', 'quantity'],
          include: [
            {
              model: Badges,
              as: 'badgeDetails',
              attributes: ['id', 'name', 'description', 'image', 'point_value'],
            },
          ],
        },
        {
          model: StudentQuizAttempt,
          as: 'attempts',
          required: false,
          attributes: ['score'],
          where: {
            status: 'selesai',
          },
        },
      ],
    });

    if (!response) {
      return res.status(404).json({
        message: 'Student Tidak Ditemukan',
      });
    }

    // Ubah ke JSON agar mudah dimanipulasi
    const responseData = response.toJSON();

    // Hitung total_points untuk setiap badge
    responseData.badges = responseData.badges.map((badge) => {
      const pointValue = badge.badgeDetails?.point_value || 0;
      const qty = badge.quantity || 0;
      return {
        ...badge,
        total_points: pointValue * qty, // tambah field total_points
      };
    });
    console.log(responseData.attempts);
    responseData.pure_point = responseData.attempts.reduce(
      (acc, attempt) => acc + (attempt.score || 0),
      0
    );

    const totalBadgePoints = responseData.badges.reduce(
      (acc, badge) => acc + badge.total_points,
      0
    );
    responseData.badge_point = totalBadgePoints;
    responseData.total_points = responseData.pure_point + totalBadgePoints;
    responseData.pure_point = parseFloat(responseData.pure_point.toFixed(2));
    responseData.total_points = parseFloat(responseData.total_points.toFixed(2));

    res.status(200).json({ student: responseData, message: 'Data ditemukan' });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const getStudentDetails = async (req, res) => {
  try {
    const response = await Student.findOne({
      where: {
        user_id: req.params.user_id,
      },
      attributes: {
        include: ['id', 'user_id', 'name', 'photo', 'level', 'streak_count'],
      },
      include: [
        {
          model: Class,
          as: 'wali_kelas',
          attributes: ['class_name'],
        },
        {
          model: StudentBadges,
          as: 'badges',
          required: false,
          attributes: ['id', 'badges_id', 'earned_at', 'quantity'],
          include: [
            {
              model: Badges,
              as: 'badgeDetails',
              attributes: ['id', 'name', 'description', 'image', 'point_value'],
            },
          ],
        },
        {
          model: StudentQuizAttempt,
          as: 'attempts',
          required: false,
          attributes: ['score'],
          where: {
            status: 'selesai',
          },
        },
      ],
    });

    if (!response) {
      return res.status(404).json({
        message: 'Student tidak ditemukan',
      });
    }

    const responseData = response.toJSON();

    responseData.badges = Array.isArray(responseData.badges) ? responseData.badges : [];
    responseData.badges = responseData.badges.map((badge) => {
      const pointValue = badge.badgeDetails?.point_value || 0;
      const qty = badge.quantity || 0;
      return {
        ...badge,
        total_points: pointValue * qty,
      };
    });

    responseData.attempts = Array.isArray(responseData.attempts) ? responseData.attempts : [];
    responseData.pure_point = responseData.attempts.reduce(
      (acc, attempt) => acc + attempt.score,
      0
    );

    const totalBadgePoints = responseData.badges.reduce(
      (acc, badge) => acc + badge.total_points,
      0
    );
    responseData.badge_point = totalBadgePoints;
    responseData.total_points = responseData.pure_point + totalBadgePoints;
    responseData.pure_point = parseFloat(responseData.pure_point.toFixed(2));
    responseData.total_points = parseFloat(responseData.total_points.toFixed(2));

    res.status(200).json({
      student: responseData,
      message: 'Data ditemukan',
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const createStudent = async (req, res) => {
  const {
    user_id,
    password,
    confirmPassword,
    name,
    class_id,
    created_by,
    updated_by,
    updated_by_role,
  } = req.body;
  const t = await db.transaction(); // Mulai transaksi
  try {
    console.log(req.body);
    if (
      !user_id ||
      !name ||
      !class_id ||
      !created_by ||
      !updated_by ||
      !updated_by_role ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message: 'Semua kolom wajib diisi',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Password dan konfirmasi password tidak cocok',
      });
    }

    if (password.length < 8 || password.length > 100) {
      return res.status(400).json({
        message: 'Password harus antara 8 dan 100 karakter',
      });
    }

    if (password === user_id) {
      return res.status(400).json({
        message: 'Password tidak boleh sama dengan User ID',
      });
    }

    if (password.includes(' ')) {
      return res.status(400).json({
        message: 'Password tidak boleh mengandung spasi',
      });
    }

    if (password.toLowerCase() === 'password') {
      return res.status(400).json({
        message: "Password tidak boleh 'password'",
      });
    }

    const hashedPassword = await argon2.hash(password);
    await Users.create(
      {
        user_id: user_id,
        password: hashedPassword,
        role: 'student',
        created_by: created_by,
        updated_by: updated_by,
        updated_by_role: updated_by_role,
      },
      { transaction: t }
    );

    const result = await Student.create(
      {
        user_id: user_id,
        name: name,
        class_id: class_id,
        created_by: created_by,
        updated_by: updated_by,
        updated_by_role: updated_by_role,
      },
      { transaction: t }
    );
    await logActivity(
      {
        req,
        action: 'CREATE',
        entity: 'student',
        identifier: user_id,
        description: `Menambah data siswa ${user_id}`,
      },
      { transaction: t }
    );
    await t.commit();
    res.status(201).json({
      message: 'Student berhasil ditambahkan',
      student: result, // ✅ Kirim seluruh data siswa yang baru dibuat
      user_id: result.user_id, // ✅ Kirim user_id secara eksplisit agar mudah diambil frontend
      id: result.id, // ✅ Jika ada kolom `id` auto increment, bisa tambahkan juga kalau perlu
    });
  } catch (error) {
    await t.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        message: 'User ID Sudah Terdaftar',
      });
    }
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const createStudentsBatch = async (req, res) => {
  const students = req.body.students;

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ message: 'Data siswa tidak valid atau kosong' });
  }

  const t = await db.transaction();

  try {
    const results = [];
    for (const s of students) {
      const {
        user_id,
        password,
        confirmPassword,
        name,
        class_id,
        created_by,
        updated_by,
        updated_by_role,
      } = s;

      // Validasi dasar
      if (
        !user_id ||
        !name ||
        !class_id ||
        !created_by ||
        !updated_by ||
        !updated_by_role ||
        !password ||
        !confirmPassword
      ) {
        throw new Error(`Data tidak lengkap untuk user_id: ${user_id}`);
      }

      if (password !== confirmPassword) {
        throw new Error(`Password tidak cocok untuk user_id: ${user_id}`);
      }

      if (password.length < 8 || password.length > 100) {
        throw new Error(`Password harus 8–100 karakter (${user_id})`);
      }

      if (password === user_id) {
        throw new Error(`Password tidak boleh sama dengan User ID (${user_id})`);
      }

      if (password.includes(' ')) {
        throw new Error(`Password tidak boleh mengandung spasi (${user_id})`);
      }

      if (password.toLowerCase() === 'password') {
        throw new Error(`Password tidak boleh 'password' (${user_id})`);
      }

      const hashedPassword = await argon2.hash(password);

      const user = await Users.create(
        {
          user_id,
          password: hashedPassword,
          role: 'student',
          created_by,
          updated_by,
          updated_by_role,
        },
        { transaction: t }
      );

      const student = await Student.create(
        {
          user_id,
          name,
          class_id,
          created_by,
          updated_by,
          updated_by_role,
        },
        { transaction: t }
      );

      results.push(student);

      await logActivity(
        {
          req,
          action: 'CREATE',
          entity: 'student',
          identifier: user_id,
          description: `Import siswa ${name} (${user_id})`,
        },
        { transaction: t }
      );
    }

    await t.commit();

    res.status(201).json({
      message: `${results.length} siswa berhasil ditambahkan`,
      data: results,
    });
  } catch (error) {
    await t.rollback();
    console.error('Batch insert error:', error);
    res.status(500).json({
      message: 'Gagal menambahkan data siswa',
      error: error.message,
    });
  }
};
export const updateStudent = async (req, res) => {
  const t = await db.transaction(); // Mulai transaksi

  try {
    const student = await Student.findOne({
      where: { user_id: req.params.id },
      transaction: t,
    });

    if (!student) {
      await t.rollback();
      return res.status(404).json({ message: 'Siswa Tidak Ditemukan' });
    }

    const { id, is_active, name, class_id, reset_point, updated_by, updated_by_role } = req.body;

    const updateData = {
      id,
      name,
      class_id,
      is_active,
      updated_by,
      updated_by_role,
    };

    if (reset_point) {
      updateData.level = 1;
      updateData.streak_count = 0;
      updateData.last_submission_date = null;
    }

    // Update data siswa
    await Student.update(updateData, {
      where: { user_id: req.params.id },
      transaction: t,
    });

    // Jika reset_point true, hapus log & badge
    if (reset_point) {
      await StudentPointsLog.destroy({
        where: { student_id: req.params.id },
        transaction: t,
      });
      await StudentQuizAttempt.update(
        {
          score: 0,
          created_at: null,
          attempted_at: null,
          start_time: null,
          violation_count: 0,
          status: 'tidak-mengerjakan',
          start_time: null,
        },
        {
          where: { student_user_id: req.params.id },
          transaction: t,
        }
      );
      await StudentBadges.destroy({
        where: { student_id: req.params.id },
        transaction: t,
      });
    }

    // Log aktivitas
    await logActivity(
      {
        req,
        action: 'UPDATE',
        entity: 'student',
        identifier: req.params.id,
        description: `Mengubah data siswa ${req.params.id}${
          reset_point ? ' dan mereset poin & badge' : ''
        }`,
      },
      { transaction: t }
    );

    await t.commit();
    res.status(200).json({
      message: `Siswa berhasil diupdate${reset_point ? ' dan poin direset' : ''}`,
    });
  } catch (error) {
    await t.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'User ID Sudah Terdaftar' });
    }
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const deleteStudent = async (req, res) => {
  const t = await db.transaction();
  try {
    const student = await Student.findOne({
      where: {
        user_id: req.params.id,
      },
      transaction: t,
    });
    if (!student) {
      await t.rollback();
      return res.status(404).json({
        message: 'Siswa Tidak Ditemukan',
      });
    }
    if (student.foto) {
      const filePath = path.resolve('public', student.photo);
      console.log('Path file yang akan dihapus:', filePath);

      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('File berhasil dihapus:', filePath);
        } else {
          console.log('File tidak ditemukan, skip hapus.');
        }
      } catch (fileError) {
        await t.rollback();
        return res
          .status(500)
          .json({ message: 'Gagal menghapus foto siswa', error: fileError.message });
      }
    }
    await Student.destroy({
      where: {
        user_id: student.user_id,
      },
      transaction: t,
    });
    await t.commit();
    res.status(200).json({ message: 'Siswa berhasil dihapus' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const deleteStudentPhoto = async (req, res) => {
  const t = await db.transaction();
  try {
    const student = await Student.findOne({
      where: { id: req.params.id },
      transaction: t,
    });

    if (!student) {
      await t.rollback();
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    if (!student.photo) {
      await t.rollback();
      return res.status(400).json({ message: 'Siswa tidak memiliki foto untuk dihapus' });
    }

    const filePath = path.resolve('public', student.photo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    student.photo = null;
    await student.save({ transaction: t });

    await t.commit();
    res.status(200).json({ message: 'Foto siswa berhasil dihapus' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({
      message: 'Gagal menghapus foto siswa',
      error: err.message,
    });
  }
};
export const uploadStudentPhoto = async (req, res) => {
  const t = await db.transaction();
  let oldPhotoPath = null;

  try {
    const student = await Student.findByPk(req.params.id, { transaction: t });
    if (!student) {
      await t.rollback();
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    if (!req.file) {
      await t.rollback();
      return res.status(400).json({ message: 'File tidak ditemukan' });
    }

    const role = req.body.role;
    const filename = req.file.filename;
    let targetDir = `public/images/${role}`;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const newPath = path.join(targetDir, filename);
    fs.renameSync(req.file.path, newPath);

    // Simpan path lama untuk dihapus nanti
    oldPhotoPath = student.photo ? path.join('public', student.photo) : null;

    student.photo = path.join('images', path.basename(targetDir), filename);
    await student.save({ transaction: t });

    await t.commit();

    // Di luar transaksi: hapus foto lama jika ada
    if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }

    res.json({ message: 'Foto berhasil diunggah', photo: student.photo });
  } catch (err) {
    if (!t.finished) {
      await t.rollback();
    }

    // Hapus file yang baru diupload jika masih ada
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Upload error:', err);
    res.status(500).json({ message: err.message });
  }
};
