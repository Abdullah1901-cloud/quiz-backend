import Admins from '../models/AdminModel.js';
import Users from '../models/UserModel.js';
import path from 'path';
import fs from 'fs';
import db from '../config/Database.js';
import { logActivity } from '../helpers/logActivity.js';
import argon2 from 'argon2';
export const getAdmin = async (req, res) => {
  try {
    const response = await Admins.findAll();
    res.status(200).json({ admin: response, message: 'Data ditemukan' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const getAdminById = async (req, res) => {
  try {
    const response = await Admins.findOne({
      where: {
        user_id: req.params.id,
      },
    });
    if (!response) {
      return res.status(404).json({
        message: 'Admin Tidak Ditemukan',
      });
    }
    res.status(200).json({ administrator: response, message: 'Data ditemukan' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const createAdmin = async (req, res) => {
  const {
    user_id,
    password,
    confirmPassword,
    name,
    email,
    phone_number,
    position,
    is_superadmin,
    created_by,
    updated_by,
    updated_by_role,
  } = req.body;
  const t = await db.transaction();
  try {
    console.log(req.body);
    if (
      !user_id ||
      !name ||
      !email ||
      !phone_number ||
      !position ||
      is_superadmin === undefined ||
      !created_by ||
      !updated_by
    ) {
      return res.status(400).json({
        message: 'Semua kolom wajib diisi',
      });
    }
    if (!email.includes('@')) {
      return res.status(400).json({
        message: 'Email tidak valid',
      });
    }
    if (phone_number.length < 10 || phone_number.length > 13) {
      return res.status(400).json({
        message: 'Nomor telepon tidak valid',
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
        role: 'administrator',
        created_by: created_by,
        updated_by: updated_by,
        updated_by_role: updated_by_role,
      },
      { transaction: t }
    );
    const result = await Admins.create({
      user_id: user_id,
      name: name,
      email: email,
      phone_number: phone_number,
      position: position,
      is_superadmin: is_superadmin,
      created_by: created_by,
      updated_by: updated_by,
      updated_by_role: updated_by_role,
    }, { transaction: t });
    await logActivity({
      req,
      action: 'CREATE',
      entity: 'administrator',
      identifier: user_id,
      description: `Menambah data administrator ${user_id}`,
    }, { transaction: t });
    await t.commit();
    res.status(201).json({
      message: 'Admin berhasil ditambahkan',
      admin: result,
      user_id: result.user_id,
    });
  } catch (error) {
    await t.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      const fields = error.errors.map((err) => err.path);
      const messages = [];

      if (fields.includes('user_id')) messages.push('User ID sudah terdaftar');
      if (fields.includes('email')) messages.push('Email sudah terdaftar');
      if (fields.includes('phone_number')) messages.push('Nomor telepon sudah terdaftar');

      return res.status(400).json({
        message: messages.join(', '),
      });
    }
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const updateAdmin = async (req, res) => {
  const admin = await Admins.findOne({
    where: {
      user_id: req.params.id,
    },
  });

  if (!admin) {
    return res.status(404).json({ message: 'Admin Tidak Ditemukan' });
  }

  const {
    name,
    email,
    phone_number,
    position,
    is_active,
    is_superadmin,
    created_by,
    updated_by,
    updated_by_role,
  } = req.body;

  try {
    await Admins.update(
      {
        name: name,
        email: email,
        phone_number: phone_number,
        position: position,
        is_active: is_active,
        is_superadmin: is_superadmin,
        created_by: created_by,
        updated_by: updated_by,
        updated_by_role: updated_by_role,
      },
      {
        where: {
          user_id: req.params.id,
        },
      }
    );

    res.status(200).json({ message: 'Admin berhasil diupdate' });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'User ID Sudah Terdaftar' });
    }
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const deleteAdmin = async (req, res) => {
  const t = await db.transaction();
  try {
    const admin = await Admins.findOne({
      where: {
        user_id: req.params.id,
      },
      transaction: t,
    });
    if (!admin) {
      await t.rollback();
      return res.status(404).json({
        message: 'Admin Tidak Ditemukan',
      });
    }
    if (admin.photo) {
      const filePath = path.resolve('public', admin.photo);
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
          .json({ message: 'Gagal menghapus foto admin', error: fileError.message });
      }
    }
    await Admins.destroy({
      where: {
        user_id: admin.user_id,
      },
      transaction: t,
    });
    await t.commit();
    res.status(200).json({ message: 'Admin berhasil dihapus' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const deleteAdminPhoto = async (req, res) => {
  const t = await db.transaction();
  try {
    const admin = await Admins.findOne({
      where: { id: req.params.id },
      transaction: t,
    });

    if (!admin) {
      await t.rollback();
      return res.status(404).json({ message: 'Admin tidak ditemukan' });
    }

    if (!admin.photo) {
      await t.rollback();
      return res.status(400).json({ message: 'Admin tidak memiliki foto untuk dihapus' });
    }

    const filePath = path.resolve('public', admin.photo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    admin.photo = null;
    await admin.save({ transaction: t });

    await t.commit();
    res.status(200).json({ message: 'Foto admin berhasil dihapus' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({
      message: 'Gagal menghapus foto admin',
      error: err.message,
    });
  }
};
export const uploadAdminPhoto = async (req, res) => {
  const t = await db.transaction();
  let oldPhotoPath = null;

  try {
    const admin = await Admins.findByPk(req.params.id, { transaction: t });
    if (!admin) {
      await t.rollback();
      return res.status(404).json({ message: 'Admin tidak ditemukan' });
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
    oldPhotoPath = admin.photo ? path.join('public', admin.photo) : null;

    admin.photo = path.join('images', path.basename(targetDir), filename);
    await admin.save({ transaction: t });

    await t.commit();

    // Di luar transaksi: hapus foto lama jika ada
    if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }

    res.json({ message: 'Foto berhasil diunggah', photo: admin.photo });
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
