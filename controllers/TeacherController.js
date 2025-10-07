import Teacher from '../models/TeacherModel.js';
import path from 'path';
import fs from 'fs';
import db from '../config/Database.js';
import { logActivity } from '../helpers/logActivity.js';
import Users from '../models/UserModel.js';
import argon2 from 'argon2';
export const getTeacher = async (req, res) => {
  try {
    const response = await Teacher.findAll();
    res.status(200).json({ message: 'Data ditemukan', teacher: response });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const getTeacherById = async (req, res) => {
  try {
    const response = await Teacher.findOne({
      where: {
        user_id: req.params.id,
      },
      attributes: {
        exclude: [, 'updated_at', 'created_by', 'updated_by'],
      },
    });
    if (!response) {
      return res.status(404).json({
        message: 'Teacher Tidak Ditemukan',
      });
    }
    res.status(200).json({ teacher: response, message: 'Data ditemukan' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const createTeacher = async (req, res) => {
  const { user_id, password, confirmPassword, name, created_by, updated_by, updated_by_role } =
    req.body;
  const t = await db.transaction();
  try {
    console.log(req.body);
    if (!user_id || !password || !confirmPassword || !name || !created_by || !updated_by) {
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
        role: 'teacher',
        created_by: created_by,
        updated_by: updated_by,
        updated_by_role: updated_by_role,
      },
      { transaction: t }
    );
    const result = await Teacher.create(
      {
        user_id: user_id,
        name: name,
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
        entity: 'teacher',
        identifier: user_id,
        description: `Menambah data guru ${user_id}`,
      },
      { transaction: t }
    );
    await t.commit();
    res.status(201).json({
      message: 'Guru berhasil ditambahkan',
      teacher: result, // ✅ Kirim seluruh data guru yang baru dibuat
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
export const updateTeacher = async (req, res) => {
  const teacher = await Teacher.findOne({
    where: {
      user_id: req.params.id,
    },
  });

  if (!teacher) {
    return res.status(404).json({ message: 'Guru Tidak Ditemukan' });
  }

  const { id, is_active, name, updated_by, updated_by_role } = req.body;

  try {
    await Teacher.update(
      {
        id: id,
        name: name,
        is_active: is_active,
        updated_by: updated_by,
        updated_by_role: updated_by_role,
      },
      {
        where: {
          user_id: req.params.id,
        },
      }
    );
    await logActivity({
      req,
      action: 'UPDATE',
      entity: 'teacher',
      identifier: req.params.id,
      description: `Mengubah data guru ${req.params.id}`,
    });
    res.status(200).json({ message: 'Guru berhasil diupdate' });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'User ID Sudah Terdaftar' });
    }
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};
export const deleteTeacher = async (req, res) => {
  const t = await db.transaction();
  try {
    const teacher = await Teacher.findOne({
      where: {
        user_id: req.params.id,
      },
      transaction: t,
    });
    if (!teacher) {
      await t.rollback();
      return res.status(404).json({
        message: 'Guru Tidak Ditemukan',
      });
    }
    if (teacher.photo) {
      const filePath = path.resolve('public', teacher.photo);
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
          .json({ message: 'Gagal menghapus foto guru', error: fileError.message });
      }
    }
    await Teacher.destroy({
      where: {
        user_id: teacher.user_id,
      },
      transaction: t,
    });
    await t.commit();
    res.status(200).json({ message: 'Guru berhasil dihapus' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const deleteTeacherPhoto = async (req, res) => {
  const t = await db.transaction();
  try {
    const teacher = await Teacher.findOne({
      where: { id: req.params.id },
      transaction: t,
    });

    if (!teacher) {
      await t.rollback();
      return res.status(404).json({ message: 'Guru tidak ditemukan' });
    }

    if (!teacher.photo) {
      await t.rollback();
      return res.status(400).json({ message: 'Guru tidak memiliki foto untuk dihapus' });
    }

    const filePath = path.resolve('public', teacher.photo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    teacher.photo = null;
    await teacher.save({ transaction: t });

    await t.commit();
    res.status(200).json({ message: 'Foto Guru berhasil dihapus' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({
      message: 'Gagal menghapus foto Guru',
      error: err.message,
    });
  }
};
export const uploadTeacherPhoto = async (req, res) => {
  const t = await db.transaction();
  let oldPhotoPath = null;

  try {
    const teacher = await Teacher.findByPk(req.params.id, { transaction: t });
    if (!teacher) {
      await t.rollback();
      return res.status(404).json({ message: 'Guru tidak ditemukan' });
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
    oldPhotoPath = teacher.photo ? path.join('public', teacher.photo) : null;

    teacher.photo = path.join('images', path.basename(targetDir), filename);
    await teacher.save({ transaction: t });

    await t.commit();

    // Di luar transaksi: hapus foto lama jika ada
    if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }

    res.json({ message: 'Foto berhasil diunggah', photo: teacher.photo });
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
