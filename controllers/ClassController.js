import Class from '../models/ClassModel.js';
import Admins from '../models/AdminModel.js';
import Teachers from '../models/TeacherModel.js';
import db from '../config/Database.js';
import { logActivity } from '../helpers/logActivity.js';

export const getClasses = async (req, res) => {
  try {
    const response = await Class.findAll({
      include: [
        {
          model: Teachers,
          as: 'waliKelasGuru',
          attributes: ['name'],
        },
      ],
    });
    res.status(200).json({ message: 'Data ditemukan', classes: response });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const createClass = async (req, res) => {
  const { class_name, wali_kelas ,created_by, updated_by, updated_by_role } =
    req.body;
  try {
    console.log(req.body);
    if (
      !class_name ||
      !wali_kelas ||
      !created_by ||
      !updated_by
    ) {
      return res.status(400).json({
        message: 'Semua kolom wajib diisi',
      });
    }
    const result = await Class.create({
      class_name: class_name,
      wali_kelas: wali_kelas,
      created_by: created_by,
      updated_by: updated_by,
      updated_by_role: updated_by_role,
    });
    await logActivity({
      req,
      action: 'CREATE',
      entity: 'class',
      identifier: class_name,
      description: `Menambah data kelas ${class_name}`,
    });
    res.status(201).json({
      message: 'Kelas berhasil ditambahkan',
      class: result, // ✅ Kirim seluruh data siswa yang baru dibuat
      class_name: result.class_name, // ✅ Kirim user_id secara eksplisit agar mudah diambil frontend
      id: result.id, // ✅ Jika ada kolom `id` auto increment, bisa tambahkan juga kalau perlu
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        message: 'ID Sudah Terdaftar',
      });
    }
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const updateClass = async (req, res) => {
  const kelas = await Class.findOne({
    where: {
      id: req.params.id,
    },
  });

  if (!kelas) {
    return res.status(404).json({ message: 'Kelas Tidak Ditemukan' });
  }

  const { id, class_name,wali_kelas, updated_by, updated_by_role } = req.body;

  try {
    await Class.update(
      {
        id: id,
        class_name: class_name,
        wali_kelas: wali_kelas,
        updated_by: updated_by,
        updated_by_role: updated_by_role,
      },
      {
        where: {
          id: req.params.id,
        },
      }
    );
    await logActivity({
      req,
      action: 'UPDATE',
      entity: 'kelas',
      identifier: req.params.id,
      description: `Mengubah data kelas ${req.params.id}`,
    });
    res.status(200).json({ message: 'Kelas berhasil diupdate' });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'ID Sudah Terdaftar' });
    }
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const deleteClass = async (req, res) => {
  const t = await db.transaction();
  try {
    const kelas = await Class.findOne({
      where: {
        id: req.params.id,
      },
      transaction: t,
    });
    if (!kelas) {
      await t.rollback();
      return res.status(404).json({
        message: 'Kelas Tidak Ditemukan',
      });
    }
    await Class.destroy({
      where: {
        id: kelas.id,
      },
      transaction: t,
    });
    await t.commit();
    res.status(200).json({ message: 'Kelas berhasil dihapus' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};