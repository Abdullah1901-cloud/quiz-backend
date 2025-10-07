import User from '../models/UserModel.js';
import Admins from '../models/AdminModel.js';
import argon2 from 'argon2';
import { Op, literal } from 'sequelize';
export const getUsers = async (req, res) => {
  try {
    const loggedInUser = req.session.user;

    if (!loggedInUser) {
      return res.status(401).json({ message: 'Mohon login terlebih dahulu' });
    }

    const isSuperAdmin = loggedInUser.is_superadmin;

    // Query semua user
    let whereCondition = {};
    if (!isSuperAdmin) {
      // Kalau bukan superadmin, jangan tampilkan admin lain
      whereCondition = {
        [Op.or]: [
          { role: { [Op.ne]: 'administrator' } }, // Bukan admin
          { user_id: loggedInUser.user_id } // Kecuali admin yang sedang login
        ]
      };
    }

    const response = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [{ model: Admins, as: 'adminDetails', attributes: ['is_superadmin'] }],
      where: whereCondition,
      order: [['user_id', 'ASC']],
    });

    if (response.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    const users = response.map((user) => {
      const baseUser = {
        uuid: user.uuid,
        user_id: user.user_id,
        created_by: user.created_by,
        updated_by: user.updated_by,
        updated_by_role: user.updated_by_role,
        created_at: user.created_at,
        role: user.role,
      };

      // Tambahkan is_superadmin hanya jika administrator
      if (user.role === 'administrator') {
        baseUser.is_superadmin = user.adminDetails?.is_superadmin || false;
      }

      return baseUser;
    });

    res.status(200).json({
      message: 'Data ditemukan',
      users: users,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};


export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmNewPassword, updated_by, updated_by_role } = req.body;
    if (!req.params.id || !oldPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        message: 'Semua kolom wajib diisi',
      });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        message: 'Password baru minimal 8 karakter',
      });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        message: 'Konfirmasi password tidak cocok',
      });
    }
    const user = await User.findOne({
      where: {
        uuid: req.params.id,
      },
    });
    if (!user) {
      return res.status(404).json({
        message: 'User Tidak Ditemukan',
      });
    }
    const isPasswordValid = await argon2.verify(user.password, oldPassword);
    if (!isPasswordValid) {
      return res.status(400).json({
        message: 'Password lama tidak cocok',
      });
    }
    const hashedPassword = await argon2.hash(newPassword);
    await User.update({ 
      password: hashedPassword,
      updated_by: updated_by,
      updated_by_role: updated_by_role
     }, { where: { uuid: req.params.id } });
    res.status(200).json({
      message: 'Password berhasil diubah',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });    
  }
}

export const getUsersById = async (req, res) => {
  try {
    const response = await User.findOne({
      where: {
        uuid: req.params.id,
      },
      attributes: {
        exclude: ['password'],
      },
    });

    if (!response) {
      return res.status(404).json({
        message: 'User Tidak Ditemukan',
      });
    }

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const getUsersByRole = async (req, res) => {
  try {
    const role = req.params.role;

    // Peta role ke tabel yang sesuai
    const roleTableMap = {
      student: 'students',
      administrator: 'administrators',
      teacher: 'teachers',
    };

    const tableName = roleTableMap[role];

    if (!tableName) {
      return res.status(400).json({
        message: 'Role tidak valid. Hanya menerima student, administrator, atau teacher.',
      });
    }

    const users = await User.findAll({
      where: {
        role: role,
        [Op.and]: literal(`NOT EXISTS (
          SELECT 1 FROM ${tableName} WHERE ${tableName}.user_id = users.user_id
        )`),
      },
      attributes: {
        exclude: ['password', 'uuid', 'created_at', 'updated_at'],
      },
    });

    if (!users.length) {
      return res.status(404).json({
        message: 'Tidak ada lagi user yang tersedia untuk role ini',
      });
    }

    res.status(200).json({
      message: 'Data ditemukan',
      users,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const createUser = async (req, res) => {
  const { user_id, password, confirmPassword, role, status,created_by, updated_by, updated_by_role } = req.body;
  if (password !== confirmPassword) {
    return res.status(400).json({
      message: 'Password dan Confirm Password tidak sama!',
    });
  }
  if (password.length < 6 || password.length > 100) {
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
  try {
    await User.create({
      user_id: user_id,
      password: hashedPassword,
      role: role,
      is_active: status,
      created_by: created_by,
      updated_by: updated_by,
      updated_by_role: updated_by_role,
    });
    res.status(201).json({ message: 'User berhasil dibuat' });
  } catch (error) {
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

export const updateUser = async (req, res) => {
  const user = await User.findOne({
    where: {
      uuid: req.params.id,
    },
  });

  if (!user) {
    return res.status(404).json({ message: 'User Tidak Ditemukan' });
  }

  const { user_id, password, confirmPassword, role, status, updated_by, updated_by_role } = req.body;
  let hashedPassword = user.password; // Default gunakan password lama

  // Kalau password diisi, validasi dan hash
  if (password) {
    // Validasi password
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Password dan Konfirmasi Password tidak sama!',
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
    hashedPassword = await argon2.hash(password);
  }

  try {
    await User.update(
      {
        user_id: user_id,
        password: hashedPassword,
        role: role,
        is_active: status,
        updated_by: updated_by,
        updated_by_role: updated_by_role,
      },
      {
        where: {
          uuid: req.params.id,
        },
      }
    );

    res.status(200).json({ message: 'User berhasil diupdate' });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'User ID Sudah Terdaftar' });
    }
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({
      where: {
        uuid: req.params.id,
      },
    });
    if (!user) {
      return res.status(404).json({
        message: 'User Tidak Ditemukan',
      });
    }
    await User.destroy({
      where: {
        uuid: user.uuid,
      },
    });
    res.status(200).json({ message: 'User berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
