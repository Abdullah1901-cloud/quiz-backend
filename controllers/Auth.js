import Users from '../models/UserModel.js';
import argon2 from 'argon2';
import Admins from '../models/AdminModel.js';
import Teachers from '../models/TeacherModel.js';
import Students from '../models/StudentModel.js';
import { logActivity } from '../helpers/logActivity.js';
import { Op } from 'sequelize';
import Session from '../models/SessionModel.js';

export const Login = async (req, res) => {
  try {
    const { user_id, password } = req.body;

    const user = await Users.findOne({
      where: { user_id },
      include: [
        { model: Admins, as: 'adminDetails', attributes: ['is_active', 'is_superadmin'] },
        { model: Teachers, as: 'teacherDetails', attributes: ['is_active'] },
        { model: Students, as: 'studentDetails', attributes: ['is_active', 'class_id'] },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const match = await argon2.verify(user.password, password);
    if (!match) {
      return res.status(401).json({ message: 'Password salah' });
    }

    // ✅ Validasi aktif berdasarkan role
    const role = user.role;
    const notActiveMessages = {
      administrator: 'Akun administrator tidak aktif, harap hubungi SuperAdministrator',
      teacher: 'Akun anda tidak aktif, harap hubungi Administrator',
      student: 'Akun anda tidak aktif, harap hubungi Administrator',
    };

    const isActive =
      (role === 'administrator' && user.adminDetails?.is_active) ||
      (role === 'teacher' && user.teacherDetails?.is_active) ||
      (role === 'student' && user.studentDetails?.is_active);

    if (!isActive) {
      return res.status(403).json({
        message: notActiveMessages[role] || 'Akun tidak aktif',
      });
    }
    if (role === 'administrator') {
      // 🔹 Hapus session lama user ini (jika masih ada di tabel sessions)
      await Session.destroy({
        where: { user_id: user.uuid },
      });
      req.session.user = {
        uuid: user.uuid,
        user_id: user.user_id,
        role: user.role,
        is_superadmin: user.adminDetails?.is_superadmin,
      };
      await logActivity({
        req,
        action: 'LOGIN',
        entity: user.role,
        description: 'Login berhasil',
      });
      if (user.adminDetails?.is_superadmin) {
        return res.status(200).json({
          message: 'Login berhasil sebagai Super Admin',
          user: {
            uuid: user.uuid,
            user_id: user.user_id,
            role: user.role,
            is_superadmin: true,
          },
        });
      } else {
        return res.status(200).json({
          message: 'Login berhasil sebagai Admin',
          user: {
            uuid: user.uuid,
            user_id: user.user_id,
            role: user.role,
            is_superadmin: false,
          },
        });
      }
    } else if (role === 'student') {
      // 🔹 Hapus session lama user ini (jika masih ada di tabel sessions)
      await Session.destroy({
        where: { user_id: user.uuid },
      });
      // Buat session
      req.session.user = {
        uuid: user.uuid,
        user_id: user.user_id,
        role: user.role,
        class_id: user.studentDetails?.class_id,
      };
      await logActivity({
        req,
        action: 'LOGIN',
        entity: user.role,
        description: 'Login berhasil',
      });
      return res.status(200).json({
        message: 'Login berhasil',
        user: {
          uuid: user.uuid,
          user_id: user.user_id,
          role: user.role,
        },
      });
    } else {
      // 🔹 Hapus session lama user ini (jika masih ada di tabel sessions)
      await Session.destroy({
        where: { user_id: user.uuid },
      });
      // Buat session
      req.session.user = {
        uuid: user.uuid,
        user_id: user.user_id,
        role: user.role,
      };
      await logActivity({
        req,
        action: 'LOGIN',
        entity: user.role,
        description: 'Login berhasil',
      });
      return res.status(200).json({
        message: 'Login berhasil',
        user: {
          uuid: user.uuid,
          user_id: user.user_id,
          role: user.role,
        },
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Terjadi kesalahan di server' });
  }
};

export const Me = async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      message: 'Mohon login terlebih dahulu',
    });
  }
  if (req.session.user.role === 'administrator') {
    const user = await Users.findOne({
      where: {
        uuid: req.session.user.uuid,
        role: 'administrator',
      },
      include: [{ model: Admins, as: 'adminDetails', attributes: ['is_active', 'is_superadmin'] }],
    });
    if (!user) {
      return res.status(404).json({
        message: 'User Tidak Ditemukan',
      });
    }
    return res.status(200).json({
      user: {
        uuid: user.uuid,
        user_id: user.user_id,
        role: user.role,
        is_superadmin: user.adminDetails?.is_superadmin,
      },
    });
  }
  if (req.session.user.role === 'student') {
    const user = await Users.findOne({
      where: {
        uuid: req.session.user.uuid,
        role: 'student',
      },
      include: [{ model: Students, as: 'studentDetails', attributes: ['is_active', 'class_id'] }],
    });
    if (!user) {
      return res.status(404).json({
        message: 'User Tidak Ditemukan',
      });
    }
    return res.status(200).json({
      user: {
        uuid: user.uuid,
        user_id: user.user_id,
        role: user.role,
        class_id: user.studentDetails?.class_id,
      },
    });
  }
  const user = await Users.findOne({
    where: {
      uuid: req.session.user.uuid,
    },
  });
  if (!user) {
    return res.status(404).json({
      message: 'User Tidak Ditemukan',
    });
  }
  return res.status(200).json({
    user: {
      uuid: user.uuid,
      user_id: user.user_id,
      role: user.role,
    },
  });
};

export const Logout = async (req, res) => {
  await logActivity({
    req,
    action: 'LOGOUT',
    entity: req.session.user.role,
    description: 'Logout berhasil',
  });
  req.session.destroy((err) => {
    if (err) {
      return res.status(400).json({
        message: 'Logout Gagal',
        error: err.message,
      });
    }
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
    console.log('Session berhasil dihapus');

    res.status(200).json({
      message: 'Logout Berhasil',
    });
  });
};
