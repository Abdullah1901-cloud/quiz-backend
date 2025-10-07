import StudentBadges from '../models/StudentBadgesModel.js';
import { Op } from 'sequelize';
import Students from '../models/StudentModel.js';
import Badges from '../models/BadgeModel.js';
import Classes from '../models/ClassModel.js';
import Sequelize from 'sequelize';
import StudentPointsLog from '../models/StudentPointsLogModel.js';
import fs from 'fs';
import path from 'path';
import db from '../config/Database.js';

export const getAllBadges = async (req, res) => {
  try {
    const badges = await Badges.findAll();
    if (badges.length === 0) {
      return res.status(404).json({ msg: 'No badges found' });
    }
    return res.status(200).json(badges);
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

export const editBadge = async (req, res) => {
  const t = await db.transaction(); // Mulai transaksi
  const id = req.params.id;
  const { description, point_value } = req.body;
  console.log('Received data:', { id, description, point_value, file: req.file });
  const image = req.file ? req.file.filename : null;
  try {
    const badge = await Badges.findByPk(id, { transaction: t });
    if (!badge) {
      return res.status(404).json({ msg: 'Badge not found' });
    }
    const oldPoints = badge.point_value;
    const newPoints = point_value;
    if (oldPoints !== newPoints) {
      badge.point_value = newPoints;
      await StudentPointsLog.update(
        {
          points: newPoints
        },{
        where:{
          source: `badge: ${badge.name}`
        },
        transaction: t
      })
    }
    badge.description = description;
    if (image) {
      let targetDir = './public/images/badge';
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      // Generate nama file baru di backend
      
      const ext = path.extname(req.file.originalname); // contoh: .jpg
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`; // contoh: badge_123_1718000000000.jpg
      const newPath = path.join(targetDir, filename);
      fs.renameSync(req.file.path, newPath);

      // Simpan path lama untuk dihapus nanti
      const oldPhotoPath = badge.image ? path.join('public', badge.image) : null;
      badge.image = path.join('images', 'badge', filename);
      // Hapus file foto lama jika ada
      if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }
    await badge.save({ transaction: t });
    await t.commit();
    return res.status(200).json({ msg: 'Badge updated successfully' });
  } catch (error) {
    await t.rollback();
    console.log(error);
    return res.status(500).json({ msg: error.message });
  }
};

export const getAllStudentBadges = async (req, res) => {
  try {
    // Ambil semua student beserta badge dan kelasnya
    const students = await Students.findAll({
      attributes: ['user_id', 'name'],
      include: [
        {
          model: Classes,
          as: 'wali_kelas',
          attributes: ['class_name'],
        },
        {
          model: StudentBadges,
          as: 'badges',
          attributes: ['earned_at', 'quantity'], // tambahkan atribut earned_at
          include: [
            {
              model: Badges,
              as: 'badgeDetails',
              attributes: ['id', 'name', 'point_value', 'image'],
            },
          ],
        },
      ],
    });

    // Format response sesuai kebutuhan
    const result = students.map((student) => {
      const badges = student.badges.map((sb) => ({
        ...sb.badgeDetails?.toJSON(),
        earned_at: sb.earned_at,
        quantity: sb.quantity,
      }));
      const total_badges = badges.length;
      const total_points = badges.reduce((sum, badge) => sum + (badge?.point_value * badge?.quantity || 0), 0);

      return {
        user_id: student.user_id,
        name: student.name,
        class: student.wali_kelas?.class_name || null,
        badges: badges,
        total_badges,
        total_points,
      };
    });

    if (result.length === 0) {
      return res.status(404).json({ msg: 'No student badges found' });
    }
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

export const deleteStudentBadge = async (req, res) => {
  const { user_id, badge_id } = req.params;
  try {
    const deleted = await StudentBadges.findOne({
      where: {
        [Op.and]: [{ student_id: user_id }, { badges_id: badge_id }],
      },
      include: [
        {
          model: Badges,
          as: 'badgeDetails',
          attributes: ['id', 'name', 'point_value', 'image'],
        },
      ],
    });
    if (!deleted) {
      return res.status(404).json({ msg: 'No badge found' });
    }
    const badgeName = deleted.badgeDetails ? deleted.badgeDetails.name : 'Unknown Badge';
    console.log(`Deleting badge: ${badgeName}`);
    // Hapus badge
    await Students.update(
      {
        badge_point: Sequelize.literal(
          `badge_point - ${deleted.badgeDetails ? deleted.badgeDetails.point_value : 0}`
        ),
      },
      {
        where: { user_id },
      }
    );
    await StudentPointsLog.destroy({
      where: {
        student_id: user_id,
        source: `badge: ${badgeName}`,
      },
    });
    await StudentBadges.destroy({
      where: {
        [Op.and]: [{ student_id: user_id }, { badges_id: badge_id }],
      },
    });
    return res.status(200).json({
      msg: 'Berhasil Menghapus Badge',
      badge: `Menghapus perolehan ${badgeName} dari Siswa dengan User ID: ${user_id}`,
    });
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};
