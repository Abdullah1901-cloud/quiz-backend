import Users from '../models/UserModel.js';
import Admins from '../models/AdminModel.js';
import Teachers from '../models/TeacherModel.js';
import Students from '../models/StudentModel.js';
export const verifyUser = async (req, res, next) => {
  try {
    if (!req.session.user?.uuid) {
      return res.status(401).json({ message: 'Mohon login terlebih dahulu' });
    }
    const user = await Users.findOne({
      where: { uuid: req.session.user.uuid },
      include: [
        { model: Admins, as: 'adminDetails', attributes: ['is_active', 'is_superadmin'] },
        { model: Teachers, as: 'teacherDetails', attributes: ['is_active'] },
        { model: Students, as: 'studentDetails', attributes: ['is_active'] },
      ],
    });
    if (!user) return res.status(404).json({ message: 'User Tidak Ditemukan' });

    const role = user.role;
    const isSuperAdmin = user.adminDetails?.is_superadmin;

    const isActive =
      (role === 'administrator' && user.adminDetails?.is_active) ||
      (role === 'teacher' && user.teacherDetails?.is_active) ||
      (role === 'student' && user.studentDetails?.is_active);

    if (!isActive) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid', {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: false, // -> true untuk production
        });
        return res.status(403).json({ message: 'Akun Anda dinonaktifkan, hubungi administrator' });
      });
      return;
    }
    if (role === 'administrator') {
      req.user = user;
      req.uuid = user.uuid;
      req.role = user.role;
      req.is_superadmin = isSuperAdmin;
      next();
      return;
    }

    req.user = user;
    req.uuid = user.uuid;
    req.role = user.role;
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const adminOnly = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Mohon login terlebih dahulu' });
  if (user.role !== 'administrator') {
    return res
      .status(403)
      .json({ message: 'Akses ditolak, hanya administrator yang dapat mengakses' });
  }
  next();
};

export const superAdminOnly = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Mohon login terlebih dahulu' });
  const isSuperAdmin = req.is_superadmin
  if (user.role === 'administrator' && !isSuperAdmin) {
    return res
      .status(403)
      .json({ message: 'Akses ditolak, hanya superadmin yang dapat mengakses' });
  }
  next();
}
