import Courses from '../models/CourseModel.js';
import Admins from '../models/AdminModel.js';
import { logActivity } from '../helpers/logActivity.js';

export const getCourses = async (req, res) => {
  try {
    const response = await Courses.findAll();
    if (response.length === 0) {
      return res.status(404).json({
        message: 'Belum ada mata pelajaran yang terdaftar',
      });
    }
    res.status(200).json({ message: 'Data ditemukan', courses: response });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const response = await Courses.findOne({
      where: {
        id: req.params.id,
      },
    });
    if (!response) {
      return res.status(404).json({
        message: 'Course Tidak Ditemukan',
      });
    }
    res.status(200).json({ course: response, message: 'Data ditemukan' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const createCourse = async (req, res) => {
  const { kd_mapel, nama_mapel, created_by, updated_by, updated_by_role } =
    req.body;
  try {
    console.log(req.body);
    if (
      !kd_mapel ||
      !nama_mapel ||
      !created_by ||
      !updated_by
    ) {
      return res.status(400).json({
        message: 'Semua kolom wajib diisi',
      });
    }
    const result = await Courses.create({
      kd_mapel: kd_mapel,
      nama_mapel: nama_mapel,
      created_by: created_by,
      updated_by: updated_by,
      updated_by_role: updated_by_role,
    });
    await logActivity({
      req,
      action: 'CREATE',
      entity: 'courses',
      identifier: kd_mapel,
      description: `Menambah data mata pelajaran ${kd_mapel}`,
    });
    res.status(201).json({
      message: 'Mata Pelajaran berhasil ditambahkan',
      course: result, // ✅ Kirim seluruh data siswa yang baru dibuat
      kd_mapel: result.kd_mapel, // ✅ Kirim user_id secara eksplisit agar mudah diambil frontend
      id: result.id, // ✅ Jika ada kolom `id` auto increment, bisa tambahkan juga kalau perlu
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        message: 'Kode Mata Pelajaran Sudah Terdaftar',
      });
    }
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const updateCourse = async (req, res) => {
  const course = await Courses.findOne({
    where: {
      id: req.params.id,
    },
  });

  if (!course) {
    return res.status(404).json({ message: 'Mata Pelajaran Tidak Ditemukan' });
  }

  const { kd_mapel, nama_mapel, updated_by, updated_by_role } = req.body;

  try {
    await Courses.update(
      {
        kd_mapel: kd_mapel,
        nama_mapel: nama_mapel,
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
      entity: 'courses',
      identifier: req.params.id,
      description: `Mengubah data mata pelajaran ${req.params.id}`,
    });
    res.status(200).json({ message: 'Mata pelajaran berhasil diupdate'});
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Kode Mata Pelajaran Sudah Terdaftar' });
    }
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const course = await Courses.findOne({
      where: {
        id: req.params.id,
      }
    });
    if (!course) {
      return res.status(404).json({
        message: 'Mata Pelajaran Tidak Ditemukan',
      });
    }
    await Courses.destroy({
      where: {
        id: course.id,
      }
    });
    res.status(200).json({ message: 'Mata Pelajaran berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};