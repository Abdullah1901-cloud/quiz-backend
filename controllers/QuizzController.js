import Class from '../models/ClassModel.js';
import Courses from '../models/CourseModel.js';
import Quizz from '../models/QuizzModel.js';
import Teachers from '../models/TeacherModel.js';
import Option from '../models/OptionModel.js';
import Students from '../models/StudentModel.js';
import Question from '../models/QuestionModel.js';
import StudentQuizAttempt from '../models/studentQuizz/quizzAttemptModel.js';
import StudentPointsLog from '../models/StudentPointsLogModel.js';
import StudentAnswer from '../models/studentQuizz/studentAnswerModel.js';
import { Op } from 'sequelize';
import path from 'path';
import fs from 'fs';
import db from '../config/Database.js';
import { logActivity } from '../helpers/logActivity.js';
import PdfPrinter from 'pdfmake';

const moveFileToPermanent = (tmpPath, targetFolder) => {
  const absoluteOldPath = path.join('public', tmpPath);
  const filename = path.basename(tmpPath);
  const targetDir = path.join('public', targetFolder);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const newRelativePath = path.join(targetFolder, filename);
  const absoluteNewPath = path.join('public', newRelativePath);
  fs.renameSync(absoluteOldPath, absoluteNewPath);

  return newRelativePath;
};
export const includeQuizzDetails = () => [
  {
    model: Class,
    as: 'classDetails',
    attributes: ['class_name'],
  },
  {
    model: Courses,
    as: 'coursesIdDetails',
    attributes: ['nama_mapel'],
  },
  {
    model: Teachers,
    as: 'teacherDetails',
    attributes: ['name'],
  },
];
export const includeStudentQuizzDetails = () => [
  {
    model: Class,
    as: 'classDetails',
    attributes: ['class_name'],
  },
  {
    model: Courses,
    as: 'coursesIdDetails',
    attributes: ['nama_mapel'],
  },
  {
    model: Teachers,
    as: 'teacherDetails',
    attributes: ['name'],
  },
];

export const getQuizzes = async (req, res) => {
  try {
    const response = await Quizz.findAll({
      include: [
        {
          model: Question,
          as: 'questions',
          include: [
            {
              model: Option,
              as: 'options',
            },
          ],
        },
        {
          model: Class,
          as: 'classDetails',
          attributes: ['class_name'],
        },
        {
          model: Courses,
          as: 'coursesIdDetails',
          attributes: ['nama_mapel'],
        },
        {
          model: Teachers,
          as: 'teacherDetails',
          attributes: ['name'],
        },
      ],
    });
    if (!response) {
      return res.status(404).json({
        message: 'Quizz Tidak Ditemukan',
      });
    }
    res.status(200).json({ message: 'Data ditemukan', quizzes: response });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const getStudentQuizzes = async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      message: 'Mohon login terlebih dahulu',
    });
  }
  try {
    const response = await Quizz.findAll({
      include: includeStudentQuizzDetails(),
      where: {
        is_active: true,
        class_id: req.session.user.class_id,
        is_deleted: false,
      },
      attributes: {
        exclude: [
          'courses_id',
          'class_id',
          'is_active',
          'is_deleted',
          'updated_by',
          'updated_by_role',
          'created_at',
          'updated_at',
        ],
      },
    });
    if (response.length === 0) {
      console.log('No quizzes found'); // Tambahkan ini
      return res.status(404).json({
        message: 'Tidak ada kuis yang aktif saat ini',
      });
    }
    console.log('Active quizzes found:', response.length); // Tambahkan ini
    res.status(200).json({ message: 'Data ditemukan', quizzes: response });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const getQuizzById = async (req, res) => {
  try {
    const response = await Quizz.findOne({
      where: {
        id: req.params.id,
        is_deleted: false, // Pastikan hanya mengambil kuis yang tidak dihapus
      },
      include: includeQuizzDetails(),
      attributes: {
        exclude: ['created_by', 'updated_by', 'teacher_id', 'courses_id', 'class_id'],
      },
    });
    if (!response) {
      return res.status(404).json({
        message: 'Quizz Tidak Ditemukan',
      });
    }
    res.status(200).json({ quizz: response, message: 'Data ditemukan' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const getPastQuizzByTeacherId = async (req, res) => {
  try {
    const response = await Quizz.findAll({
      where: {
        teacher_id: req.params.id,
        is_active: false,
        is_deleted: false, // Pastikan hanya mengambil kuis yang tidak dihapus
        end: {
          [Op.lt]: new Date(), // hanya kuis yang end >= sekarang
        },
      },
      include: includeQuizzDetails(),
      attributes: {
        exclude: ['created_by', 'updated_by', 'teacher_id'],
      },
    });
    if (!response) {
      return res.status(404).json({
        message: 'Quizz Tidak Ditemukan',
      });
    }
    res.status(200).json({ pastQuizzes: response, message: 'Data ditemukan' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const getFutureQuizzByTeacherId = async (req, res) => {
  try {
    const response = await Quizz.findAll({
      where: {
        teacher_id: req.params.id,
        is_active: false,
        is_deleted: false, // Pastikan hanya mengambil kuis yang tidak dihapus
        start: {
          [Op.gte]: new Date(), // hanya kuis yang start >= sekarang
        },
      },
      include: [
        {
          model: Question,
          as: 'questions',
          include: [
            {
              model: Option,
              as: 'options',
            },
          ],
        },
        {
          model: Class,
          as: 'classDetails',
          attributes: ['class_name'],
        },
        {
          model: Courses,
          as: 'coursesIdDetails',
          attributes: ['nama_mapel'],
        },
      ],
      attributes: {
        exclude: ['created_by', 'updated_by', 'teacher_id'],
      },
    });
    if (!response) {
      return res.status(404).json({
        message: 'Quizz Tidak Ditemukan',
      });
    }
    res.status(200).json({ futureQuizzes: response, message: 'Data ditemukan' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const getQuizzWithQuestions = async (req, res) => {
  const id = req.params.id;

  try {
    const quizz = await Quizz.findOne({
      where: { id: id },
      include: [
        {
          model: Question,
          as: 'questions',
          include: [
            {
              model: Option,
              as: 'options',
            },
          ],
        },
      ],
    });

    if (!quizz) {
      return res.status(404).json({ message: 'Kuis tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Kuis Ditemukan',
      quizz: quizz,
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data kuis', error: error.message });
  }
};
export const getQuizzByTeacherId = async (req, res) => {
  try {
    const response = await Quizz.findAll({
      where: {
        teacher_id: req.params.id,
        is_deleted: false, // Pastikan hanya mengambil kuis yang tidak dihapus
      },
      include: includeQuizzDetails(),
      attributes: {
        exclude: ['created_by', 'updated_by', 'teacher_id', 'courses_id', 'class_id'],
      },
    });
    if (response.length === 0) {
      return res.status(404).json({
        message: 'Quizz Tidak Ditemukan',
      });
    }
    res.status(200).json({ quizzes: response, message: 'Data ditemukan' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const getActiveQuizzByTeacherId = async (req, res) => {
  try {
    const response = await Quizz.findAll({
      where: {
        teacher_id: req.params.id,
        is_active: true,
        is_deleted: false, // Pastikan hanya mengambil kuis yang tidak dihapus
      },
      include: includeQuizzDetails(),
      attributes: {
        exclude: ['created_by', 'updated_by', 'teacher_id', 'courses_id', 'class_id'],
      },
    });
    if (!response) {
      return res.status(404).json({
        message: 'Quizz Tidak Ditemukan',
      });
    }
    res.status(200).json({ activeQuizzes: response, message: 'Data ditemukan' });
  } catch (error) {
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const createQuizz = async (req, res) => {
  const fileMap = {};
  if (req.files) {
    // Loop melalui semua field yang ada
    Object.entries(req.files).forEach(([fieldname, files]) => {
      if (Array.isArray(files) && files.length > 0) {
        fileMap[fieldname] = files[0].path.replace(/^public[\\/]+/, '');
      }
    });
  }

  const {
    study_material,
    description,
    teacher_id,
    courses_id,
    class_id,
    duration,
    strict,
    created_by,
    updated_by,
    updated_by_role,
    total_question,
    start,
    end,
  } = req.body;

  let questions = [];
  try {
    questions = JSON.parse(req.body.questions || '[]');
  } catch (err) {
    return res.status(400).json({ message: 'Format questions tidak valid.' });
  }

  const t = await db.transaction();
  const usedFiles = new Set();

  try {
    if (
      !study_material ||
      !description ||
      !teacher_id ||
      !courses_id ||
      !class_id ||
      !duration ||
      strict === undefined ||
      !start ||
      !end ||
      !created_by ||
      !updated_by ||
      questions.length === 0
    ) {
      console.log(
        study_material,
        description,
        teacher_id,
        courses_id,
        class_id,
        duration,
        strict,
        start,
        end,
        created_by,
        updated_by,
        questions.length
      );
      return res.status(400).json({ message: 'Semua kolom wajib diisi dan minimal 1 soal.' });
    }

    if (new Date(start) >= new Date(end)) {
      return res.status(400).json({ message: 'Tanggal mulai harus sebelum tanggal selesai.' });
    }

    if (total_question <= 0 || duration <= 5) {
      return res.status(400).json({ message: 'Jumlah soal & durasi tidak valid.' });
    }
    const defaultPoint = parseFloat((100 / total_question).toFixed(2));
    const hasCustomPoints = questions.some((q) => q.point !== undefined && q.point !== null);
    if (hasCustomPoints) {
      const totalPoints = questions.reduce((sum, q) => sum + (q.point || 0), 0);
      if (totalPoints !== 100) {
        return res.status(400).json({ message: `Total poin harus 100, sekarang ${totalPoints}` });
      }
    }

    // Tangani gambar utama kuis (jika ada)
    let quizImagePath = null;
    if (fileMap['quiz_image']) {
      quizImagePath = moveFileToPermanent(fileMap['quiz_image'], 'images/quizz');
      usedFiles.add('quiz_image');
    }

    const quizz = await Quizz.create(
      {
        study_material,
        description,
        total_question,
        teacher_id,
        courses_id,
        class_id,
        duration,
        strict,
        created_by,
        updated_by,
        updated_by_role,
        start,
        end,
        image: quizImagePath,
      },
      { transaction: t }
    );

    const questionsResult = [];

    for (let qIndex = 0; qIndex < questions.length; qIndex++) {
      const q = questions[qIndex];
      let point;
      if (hasCustomPoints) {
        point = questions[qIndex].point || 0;
      } else {
        if (qIndex === questions.length - 1) {
          point = 100 - defaultPoint * (questions.length - 1);
          point = parseFloat(point.toFixed(2));
        } else {
          point = defaultPoint;
        }
      }

      let newQuestionImagePath = null;
      const fieldName = `question_image_${qIndex}`;
      const file = req.files[fieldName]?.[0];

      // Handle gambar soal
      if (file) {
        const dir = 'public/images/questions';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, file.filename);
        fs.renameSync(file.path, target);
        newQuestionImagePath = path.join('images', 'questions', file.filename);
      }

      let questionImagePath = newQuestionImagePath || null;

      const question = await Question.create(
        {
          quiz_id: quizz.id,
          question_text: q.question_text,
          image: questionImagePath,
          point,
        },
        { transaction: t }
      );

      const optionsResult = [];
      for (let oIndex = 0; oIndex < q.options.length; oIndex++) {
        const opt = q.options[oIndex];
        const optField = `option_image_${qIndex}_${oIndex}`;
        const optFile = req.files[optField]?.[0];

        let newOptionImagePath = null;
        if (optFile) {
          const dir = 'public/images/options';
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const target = path.join(dir, optFile.filename);
          fs.renameSync(optFile.path, target);
          newOptionImagePath = path.join('images', 'options', optFile.filename);
        }

        let optionImagePath = newOptionImagePath || null;

        const createdOption = await Option.create(
          {
            question_id: question.id,
            option_text: opt.option_text,
            image: optionImagePath,
            is_correct: !!opt.is_correct,
          },
          { transaction: t }
        );

        optionsResult.push({ id: createdOption.id });
      }

      questionsResult.push({ id: question.id, options: optionsResult });
    }

    await t.commit();
    res.status(201).json({
      message: 'Kuis dan soal berhasil dibuat',
      quizzId: quizz.id,
      study_material: quizz.study_material,
      questionsResult,
    });
  } catch (err) {
    await t.rollback();
    console.error('[CreateQuizz Error]', err);

    // Cleanup files that were not used
    for (const [fieldname, relPath] of Object.entries(fileMap)) {
      if (!usedFiles.has(fieldname)) {
        try {
          const fullPath = path.join('public', relPath);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch (e) {
          console.warn('Gagal hapus file tidak terpakai:', relPath);
        }
      }
    }

    res.status(500).json({ message: 'Gagal membuat kuis', error: err.message });
  }
};
export const cloneQuiz = async (req, res) => {
  const { id } = req.params;
  const { class_id, start, end, created_by, updated_by, updated_by_role } = req.body;

  const t = await db.transaction();
  try {
    const original = await Quizz.findByPk(id, {
      include: [
        {
          model: Question,
          as: 'questions',
          include: [
            {
              model: Option,
              as: 'options',
            },
          ],
        },
      ],
    });

    if (!original) {
      return res.status(404).json({ message: 'Kuis tidak ditemukan' });
    }

    const newQuiz = await Quizz.create(
      {
        study_material: original.study_material,
        description: original.description,
        teacher_id: original.teacher_id,
        courses_id: original.courses_id,
        total_question: original.total_question,
        class_id,
        duration: original.duration,
        image: original.image,
        strict: original.strict,
        is_active: false,
        start,
        end,
        created_by,
        updated_by,
        updated_by_role,
      },
      { transaction: t }
    );

    for (const q of original.questions) {
      const newQuestion = await Question.create(
        {
          quiz_id: newQuiz.id,
          question_text: q.question_text,
          image: q.image,
          point: q.point,
        },
        { transaction: t }
      );

      for (const opt of q.options) {
        await Option.create(
          {
            question_id: newQuestion.id,
            option_text: opt.option_text,
            image: opt.image,
            is_correct: opt.is_correct,
          },
          { transaction: t }
        );
      }
    }

    await t.commit();
    return res.status(201).json({ message: 'Kuis berhasil digandakan', newQuizId: newQuiz.id });
  } catch (err) {
    await t.rollback();
    console.error('[CloneQuiz Error]', err);
    res.status(500).json({ message: 'Gagal menggandakan kuis' });
  }
};

export const updateQuizz = async (req, res) => {
  const {
    study_material,
    description,
    teacher_id,
    courses_id,
    class_id,
    duration,
    strict,
    updated_by,
    updated_by_role,
    total_question,
    start,
    is_deleted,
    end,
    remove_quiz_image,
  } = req.body;
  let questions = req.body.questions;
  if (typeof questions === 'string') {
    try {
      questions = JSON.parse(questions);
    } catch (e) {
      return res.status(400).json({ message: 'Format pertanyaan tidak valid.' });
    }
  }
  const t = await db.transaction();

  try {
    const quizz = await Quizz.findByPk(req.params.id);
    if (!quizz) {
      return res.status(404).json({ message: 'Kuis tidak ditemukan' });
    }
    if (quizz.is_active) {
      return res.status(400).json({ message: 'Kuis sedang aktif, tidak dapat dirubah sekarang.' });
    }
    // Validasi umum
    if (
      !study_material ||
      !description ||
      !teacher_id ||
      !courses_id ||
      !class_id ||
      !duration ||
      strict === undefined ||
      !start ||
      !end ||
      !updated_by ||
      questions.length === 0
    ) {
      return res.status(400).json({ message: 'Semua kolom wajib diisi dan minimal 1 soal.' });
    }
    if (new Date(start) >= new Date(end)) {
      return res.status(400).json({ message: 'Tanggal mulai harus sebelum tanggal selesai.' });
    }
    if (total_question <= 0) {
      return res.status(400).json({ message: 'Jumlah soal harus lebih dari 0.' });
    }
    if (duration <= 5) {
      return res.status(400).json({ message: 'Waktu yang diberikan harus lebih dari 5 menit.' });
    }

    const defaultPoint = parseFloat((100 / total_question).toFixed(2));
    const allPointsAreDefault = questions.every(
      (q) => Math.abs((q.point || 0) - defaultPoint) < 0.01
    );

    const hasCustomPoints =
      questions.some((q) => q.point !== undefined && q.point !== null) && !allPointsAreDefault;

    if (hasCustomPoints) {
      const totalPoints = questions.reduce((sum, q) => sum + (q.point || 0), 0);
      if (Math.round(totalPoints * 100) / 100 !== 100) {
        return res.status(400).json({
          message: `Total poin dari semua soal harus 100 jika Anda mengatur poin manual. Saat ini total: ${totalPoints}`,
        });
      }
    }
    let image = quizz.image; // Simpan gambar lama jika tidak dihapus
    if (remove_quiz_image && quizz.image) {
      try {
        const delImage = await Quizz.findAll({
          where: {
            image: quizz.image,
          },
        });
        if (delImage.length <= 1) {
          const filePath = path.resolve('public', quizz.image);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          image = null; // Set gambar ke null jika dihapus
        } else {
          image = null;
        }
      } catch (error) {
        console.error('Gagal menghapus gambar kuis:', error);
      }
    } else if (req.files['quiz_image']) {
      const place = 'quizz';
      const filename = req.files['quiz_image'][0].filename;
      const targetDir = `public/images/${place}`;
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const newPath = path.join(targetDir, filename);
      fs.renameSync(req.files['quiz_image'][0].path, newPath);
      image = path.join('images', place, filename);
    }

    // Update kuis
    await quizz.update(
      {
        study_material,
        description,
        total_question,
        teacher_id,
        courses_id,
        class_id,
        duration,
        strict,
        start,
        end,
        updated_by,
        updated_by_role,
        is_deleted,
        image: image,
      },
      { transaction: t }
    );

    // Ambil soal lama
    const oldQuestions = await Question.findAll({
      where: { quiz_id: quizz.id },
      include: [
        {
          model: Option,
          as: 'options',
        },
      ],
      transaction: t,
    });

    const oldQuestionIds = oldQuestions.map((q) => q.id);
    const newQuestionIds = questions.filter((q) => q.id).map((q) => q.id);

    // 1. Hapus soal yang dihapus
    const questionsToDelete = oldQuestions.filter((q) => !newQuestionIds.includes(q.id));
    for (const q of questionsToDelete) {
      // Hapus gambar opsi terkait
      for (const opt of q.options) {
        if (opt.image) {
          try {
            const delImage = await Option.findAll({
              where: {
                image: opt.image,
              },
            });
            if (delImage.length <= 1) {
              const filePath = path.resolve('public', opt.image);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error('Gagal menghapus gambar soal:', error);
          }
        }
        await Option.destroy({ where: { id: opt.id }, transaction: t });
      }
      if (q.image) {
        try {
          const delImage = await Question.findAll({
            where: {
              image: q.image,
            },
          });
          if (delImage.length <= 1) {
            const filePath = path.resolve('public', q.image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        } catch (error) {
          console.error('Gagal menghapus gambar soal:', error);
        }
      }
      await Question.destroy({ where: { id: q.id }, transaction: t });
    }

    // 2. Tambah/Update soal & opsi
    for (let qIndex = 0; qIndex < questions.length; qIndex++) {
      const q = questions[qIndex];
      let point;
      if (hasCustomPoints) {
        point = q.point || 0;
      } else {
        // Otomatis, soal terakhir dapat sisa pembulatan
        if (qIndex === questions.length - 1) {
          point = 100 - defaultPoint * (questions.length - 1);
          point = parseFloat(point.toFixed(2));
        } else {
          point = defaultPoint;
        }
      }
      let question;
      let newQuestionImagePath = null;
      const fieldName = `question_image_${qIndex}`;
      const file = req.files[fieldName]?.[0];

      // Handle gambar soal
      if (file) {
        const dir = 'public/images/questions';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, file.filename);
        fs.renameSync(file.path, target);
        newQuestionImagePath = path.join('images', 'questions', file.filename);
      }

      if (q.id && oldQuestionIds.includes(q.id)) {
        // Update soal lama
        question = await Question.findByPk(q.id, { transaction: t });

        if (q.remove_image && question.image) {
          try {
            const delImage = await Question.findAll({
              where: {
                image: question.image,
              },
            });
            if (delImage.length <= 1) {
              const oldPath = path.resolve('public', question.image);
              if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
              question.image = null;
            }
          } catch (error) {
            console.error('Gagal menghapus gambar soal:', error);
          }
        }
        await question.update(
          {
            question_text: q.question_text,
            point,
            image: newQuestionImagePath ?? (q.remove_image ? null : question.image),
          },
          { transaction: t }
        );
      } else {
        // Soal baru
        question = await Question.create(
          {
            quiz_id: quizz.id,
            question_text: q.question_text,
            point,
            image: newQuestionImagePath || null,
          },
          { transaction: t }
        );
      }

      // ========== OPSI ==========
      const oldOptions = await Option.findAll({
        where: { question_id: question.id },
        transaction: t,
      });
      const oldOptionIds = oldOptions.map((opt) => opt.id);
      const newOptions = q.options || [];
      const newOptionIds = newOptions.filter((opt) => opt.id).map((opt) => opt.id);

      const optionsToDelete = oldOptions.filter((opt) => !newOptionIds.includes(opt.id));
      for (const opt of optionsToDelete) {
        if (opt.image) {
          try {
            const delImage = await Option.findAll({
              where: {
                image: opt.image,
              },
            });
            if (delImage.length <= 1) {
              const filePath = path.resolve('public', opt.image);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error('Gagal menghapus gambar soal:', error);
          }
        }
        await Option.destroy({ where: { id: opt.id }, transaction: t });
      }

      for (let oIndex = 0; oIndex < newOptions.length; oIndex++) {
        const opt = newOptions[oIndex];
        const optField = `option_image_${qIndex}_${oIndex}`;
        const optFile = req.files[optField]?.[0];

        let newOptionImagePath = null;
        if (optFile) {
          const dir = 'public/images/options';
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const target = path.join(dir, optFile.filename);
          fs.renameSync(optFile.path, target);
          newOptionImagePath = path.join('images', 'options', optFile.filename);
        }

        if (opt.id && oldOptionIds.includes(opt.id)) {
          const oldOpt = oldOptions.find((o) => o.id === opt.id);
          if (opt.remove_image && oldOpt.image) {
            try {
              const delImage = await Option.findAll({
                where: {
                  image: oldOpt.image,
                },
              });
              if (delImage.length <= 1) {
                const filePath = path.resolve('public', oldOpt.image);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              }
            } catch (error) {
              console.error('Gagal menghapus gambar soal:', error);
            }
          }

          await Option.update(
            {
              option_text: opt.option_text,
              is_correct: !!opt.is_correct,
              image: newOptionImagePath ?? (opt.remove_image ? null : oldOpt.image),
            },
            { where: { id: opt.id }, transaction: t }
          );
        } else {
          await Option.create(
            {
              question_id: question.id,
              option_text: opt.option_text,
              is_correct: !!opt.is_correct,
              image: newOptionImagePath || null,
            },
            { transaction: t }
          );
        }
      }
    }

    await t.commit();

    await logActivity({
      req,
      action: 'UPDATE',
      entity: 'quizz',
      identifier: req.params.id,
      description: `Mengubah data kuis ${req.params.id} dan soalnya`,
    });

    res.status(200).json({ message: 'Kuis berhasil diperbarui' });
  } catch (err) {
    await t.rollback();
    console.error('[UpdateQuizz Error]', err);
    res.status(500).json({ message: 'Gagal memperbarui kuis', error: err.message });
  }
};
export const adminUpdateQuizz = async (req, res) => {
  const {
    study_material,
    description,
    teacher_id,
    courses_id,
    class_id,
    duration,
    strict,
    updated_by,
    updated_by_role,
    total_question,
    start,
    is_deleted,
    end,
    remove_quiz_image,
  } = req.body;
  let questions = req.body.questions;
  if (typeof questions === 'string') {
    try {
      questions = JSON.parse(questions);
    } catch (e) {
      return res.status(400).json({ message: 'Format pertanyaan tidak valid.' });
    }
  }
  const t = await db.transaction();

  try {
    const quizz = await Quizz.findByPk(req.params.id, { transaction: t });
    if (!quizz) {
      await t.rollback();
      return res.status(404).json({ message: 'Kuis tidak ditemukan' });
    }
    if (quizz.is_active) {
      await t.rollback();
      return res.status(400).json({ message: 'Kuis sedang aktif, tidak dapat dirubah sekarang.' });
    }
    // Validasi umum
    if (
      !study_material ||
      !description ||
      !teacher_id ||
      !courses_id ||
      !class_id ||
      !duration ||
      strict === undefined ||
      !start ||
      !end ||
      !updated_by ||
      questions.length === 0
    ) {
      await t.rollback();
      return res.status(400).json({ message: 'Semua kolom wajib diisi dan minimal 1 soal.' });
    }
    if (new Date(start) >= new Date(end)) {
      await t.rollback();
      return res.status(400).json({ message: 'Tanggal mulai harus sebelum tanggal selesai.' });
    }
    if (total_question <= 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Jumlah soal harus lebih dari 0.' });
    }
    if (duration <= 5) {
      await t.rollback();
      return res.status(400).json({ message: 'Waktu yang diberikan harus lebih dari 5 menit.' });
    }

    const defaultPoint = parseFloat((100 / total_question).toFixed(2));
    const allPointsAreDefault = questions.every(
      (q) => Math.abs((q.point || 0) - defaultPoint) < 0.01
    );

    const hasCustomPoints =
      questions.some((q) => q.point !== undefined && q.point !== null) && !allPointsAreDefault;

    if (hasCustomPoints) {
      const totalPoints = questions.reduce((sum, q) => sum + (q.point || 0), 0);
      if (Math.round(totalPoints * 100) / 100 !== 100) {
        await t.rollback();
        return res.status(400).json({
          message: `Total poin dari semua soal harus 100 jika Anda mengatur poin manual. Saat ini total: ${totalPoints}`,
        });
      }
    }

    // ========== HANDLE QUIZ IMAGE ==========
    let image = quizz.image; // Simpan gambar lama jika tidak dihapus
    if (remove_quiz_image && quizz.image) {
      try {
        const delImage = await Quizz.findAll({
          where: { image: quizz.image },
          transaction: t,
        });
        if (delImage.length <= 1) {
          const filePath = path.resolve('public', quizz.image);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          image = null;
        } else {
          image = null;
        }
      } catch (error) {
        console.error('Gagal menghapus gambar kuis:', error);
      }
    } else if (req.files && req.files['quiz_image']) {
      const place = 'quizz';
      const filename = req.files['quiz_image'][0].filename;
      const targetDir = `public/images/${place}`;
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const newPath = path.join(targetDir, filename);
      fs.renameSync(req.files['quiz_image'][0].path, newPath);
      image = path.join('images', place, filename);
    }

    // Update kuis utama
    await quizz.update(
      {
        study_material,
        description,
        total_question,
        teacher_id,
        courses_id,
        class_id,
        duration,
        strict,
        start,
        end,
        updated_by,
        updated_by_role,
        is_deleted,
        image: image,
      },
      { transaction: t }
    );

    // Ambil soal lama (dengan opsi)
    const oldQuestions = await Question.findAll({
      where: { quiz_id: quizz.id },
      include: [{ model: Option, as: 'options' }],
      transaction: t,
    });

    const oldQuestionIds = oldQuestions.map((q) => q.id);
    const newQuestionIds = questions.filter((q) => q.id).map((q) => q.id);

    // TRACKER apakah struktur/ kunci berubah sehingga perlu recalculation
    let shouldRecalculate = false;

    // 1. Hapus soal yang dihapus (jika ada)
    const questionsToDelete = oldQuestions.filter((q) => !newQuestionIds.includes(q.id));
    if (questionsToDelete.length > 0) shouldRecalculate = true;

    for (const q of questionsToDelete) {
      // Hapus gambar opsi terkait & opsi
      for (const opt of q.options) {
        if (opt.image) {
          try {
            const delImage = await Option.findAll({
              where: { image: opt.image },
              transaction: t,
            });
            if (delImage.length <= 1) {
              const filePath = path.resolve('public', opt.image);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error('Gagal menghapus gambar opsi:', error);
          }
        }
        await Option.destroy({ where: { id: opt.id }, transaction: t });
      }
      if (q.image) {
        try {
          const delImage = await Question.findAll({
            where: { image: q.image },
            transaction: t,
          });
          if (delImage.length <= 1) {
            const filePath = path.resolve('public', q.image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        } catch (error) {
          console.error('Gagal menghapus gambar soal:', error);
        }
      }
      await Question.destroy({ where: { id: q.id }, transaction: t });
    }

    // 2. Tambah/Update soal & opsi
    for (let qIndex = 0; qIndex < questions.length; qIndex++) {
      const q = questions[qIndex];
      let point;
      if (hasCustomPoints) {
        point = q.point || 0;
      } else {
        if (qIndex === questions.length - 1) {
          point = 100 - defaultPoint * (questions.length - 1);
          point = parseFloat(point.toFixed(2));
        } else {
          point = defaultPoint;
        }
      }

      let question;
      let newQuestionImagePath = null;
      const fieldName = `question_image_${qIndex}`;
      const file = req.files?.[fieldName]?.[0];

      // Handle gambar soal baru/replace
      if (file) {
        const dir = 'public/images/questions';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, file.filename);
        fs.renameSync(file.path, target);
        newQuestionImagePath = path.join('images', 'questions', file.filename);
      }

      if (q.id && oldQuestionIds.includes(q.id)) {
        // Update soal lama
        question = await Question.findByPk(q.id, { transaction: t });

        if (q.remove_image && question.image) {
          try {
            const delImage = await Question.findAll({
              where: { image: question.image },
              transaction: t,
            });
            if (delImage.length <= 1) {
              const oldPath = path.resolve('public', question.image);
              if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
              question.image = null;
            }
          } catch (error) {
            console.error('Gagal menghapus gambar soal:', error);
          }
        }
        await question.update(
          {
            question_text: q.question_text,
            point,
            image: newQuestionImagePath ?? (q.remove_image ? null : question.image),
          },
          { transaction: t }
        );
      } else {
        // Soal baru
        question = await Question.create(
          {
            quiz_id: quizz.id,
            question_text: q.question_text,
            point,
            image: newQuestionImagePath || null,
          },
          { transaction: t }
        );
        // Menambah soal baru mengubah struktur -> perlu recalculation
        shouldRecalculate = true;
      }

      // ======= OPSI =======
      const oldOptions = await Option.findAll({
        where: { question_id: question.id },
        transaction: t,
      });
      const oldOptionIds = oldOptions.map((opt) => opt.id);
      const newOptions = q.options || [];
      const newOptionIds = newOptions.filter((opt) => opt.id).map((opt) => opt.id);

      const optionsToDelete = oldOptions.filter((opt) => !newOptionIds.includes(opt.id));
      // Jika menghapus opsi yang sebelumnya adalah yang benar -> perlu recalculation
      if (optionsToDelete.some((o) => !!o.is_correct)) shouldRecalculate = true;

      for (const opt of optionsToDelete) {
        if (opt.image) {
          try {
            const delImage = await Option.findAll({
              where: { image: opt.image },
              transaction: t,
            });
            if (delImage.length <= 1) {
              const filePath = path.resolve('public', opt.image);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error('Gagal menghapus gambar opsi:', error);
          }
        }
        await Option.destroy({ where: { id: opt.id }, transaction: t });
      }

      for (let oIndex = 0; oIndex < newOptions.length; oIndex++) {
        const opt = newOptions[oIndex];
        const optField = `option_image_${qIndex}_${oIndex}`;
        const optFile = req.files?.[optField]?.[0];

        let newOptionImagePath = null;
        if (optFile) {
          const dir = 'public/images/options';
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const target = path.join(dir, optFile.filename);
          fs.renameSync(optFile.path, target);
          newOptionImagePath = path.join('images', 'options', optFile.filename);
        }

        if (opt.id && oldOptionIds.includes(opt.id)) {
          const oldOpt = oldOptions.find((o) => o.id === opt.id);
          const oldIsCorrect = !!oldOpt.is_correct;
          const newIsCorrect = !!opt.is_correct;

          // Jika perubahan status is_correct -> perlu recalculation
          if (oldIsCorrect !== newIsCorrect) shouldRecalculate = true;

          if (opt.remove_image && oldOpt.image) {
            try {
              const delImage = await Option.findAll({
                where: { image: oldOpt.image },
                transaction: t,
              });
              if (delImage.length <= 1) {
                const filePath = path.resolve('public', oldOpt.image);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              }
            } catch (error) {
              console.error('Gagal menghapus gambar opsi:', error);
            }
          }

          await Option.update(
            {
              option_text: opt.option_text,
              is_correct: !!opt.is_correct,
              image: newOptionImagePath ?? (opt.remove_image ? null : oldOpt.image),
            },
            { where: { id: opt.id }, transaction: t }
          );
        } else {
          // Opsi baru ditambahkan ke soal (kalau opsi baru ini bertanda is_correct -> pengaruh)
          if (!!opt.is_correct) shouldRecalculate = true;

          await Option.create(
            {
              question_id: question.id,
              option_text: opt.option_text,
              is_correct: !!opt.is_correct,
              image: newOptionImagePath || null,
            },
            { transaction: t }
          );
        }
      }
    } // selesai loop soal

    // ===== Jika perlu recalculation -> lakukan di sini sebelum commit =====
    if (shouldRecalculate) {
      // Ambil question terbaru (dengan point dan opsi benar)
      const currentQuestions = await Question.findAll({
        where: { quiz_id: quizz.id },
        include: [{ model: Option, as: 'options' }],
        transaction: t,
      });

      // Map questionId -> point & correctOptionId(s)
      const questionMap = {};
      for (const cq of currentQuestions) {
        questionMap[cq.id] = {
          point: parseFloat(cq.point || 0),
          correctOptionIds: cq.options.filter((o) => !!o.is_correct).map((o) => o.id), // allow multiple correct just in case
        };
      }

      // Ambil semua attempt untuk quiz (include studentAnswers)
      const attempts = await StudentQuizAttempt.findAll({
        where: { quiz_id: quizz.id },
        include: [{ model: StudentAnswer, as: 'studentAnswers' }],
        transaction: t,
      });

      // kumpulkan siswa yang perlu diupdate pure_pointnya
      const affectedStudentIds = new Set();
      const newScoresMap = new Map();
      // Recalculate per attempt
      for (const attempt of attempts) {
        const oldScore = parseFloat(attempt.score || 0);

        // hitung skor baru berdasarkan point tiap question
        let earned = 0;
        for (const ans of attempt.studentAnswers || []) {
          const qInfo = questionMap[ans.question_id];
          if (!qInfo) continue; // soal mungkin dihapus
          // jika jawaban siswa cocok dengan salah satu correctOptionIds
          if (ans.selected_option_id && qInfo.correctOptionIds.includes(ans.selected_option_id)) {
            earned += qInfo.point;
          }
        }
        // Pastikan precision 2 digit
        const newScore = Math.round((earned + Number.EPSILON) * 100) / 100;

        // update attempt jika berbeda
        if (Math.abs(newScore - oldScore) > 0.001) {
          await attempt.update({ score: newScore }, { transaction: t });
        }
        newScoresMap.set(attempt.uuid, newScore);
        affectedStudentIds.add(attempt.student_user_id);
      }

      // Update students.pure_point per siswa yang terpengaruh: set = SUM skor semua attempt (dibulatkan)
      // Update students dan log
      for (const studentId of Array.from(affectedStudentIds)) {
        const totalPointsRaw = await StudentQuizAttempt.sum('score', {
          where: { student_user_id: studentId },
          transaction: t,
        });
        const roundedTotal = Math.round((totalPointsRaw || 0 + Number.EPSILON) * 100) / 100;

        const studentRow = await Students.findOne({
          where: { user_id: studentId },
          transaction: t,
        });
        const oldPure = studentRow?.pure_point ? parseFloat(studentRow.pure_point) : 0;

        await Students.update(
          { pure_point: roundedTotal },
          { where: { user_id: studentId }, transaction: t }
        );

        // --- update StudentPointsLog pakai newScore dari attempt ---
        // ambil attempt terbaru untuk quiz ini
        const latestAttempt = attempts.find(
          (a) => a.student_user_id === studentId && a.quiz_id === quizz.id
        );
        const newScore = latestAttempt ? newScoresMap.get(latestAttempt.uuid) : null;

        if (newScore !== null) {
          const existingLog = await StudentPointsLog.findOne({
            where: {
              student_id: studentId,
              source: `quiz: ${quizz.id}`,
            },
            transaction: t,
          });

          if (existingLog) {
            await existingLog.update(
              {
                points: newScore, // langsung nilai akhir quiz
                source: `recalc_quiz: ${quizz.id}`,
              },
              { transaction: t }
            );
          } 
        }
      }
    }

    // COMMIT kalau semua ok
    await t.commit();

    await logActivity({
      req,
      action: 'UPDATE',
      entity: 'quizz',
      identifier: req.params.id,
      description: `Mengubah data kuis ${req.params.id} dan soalnya`,
    });

    res.status(200).json({ message: 'Kuis berhasil diperbarui' });
  } catch (err) {
    await t.rollback();
    console.error('[UpdateQuizz Error]', err);
    res.status(500).json({ message: 'Gagal memperbarui kuis', error: err.message });
  }
};

export const deleteQuizz = async (req, res) => {
  try {
    const quizz = await Quizz.findOne({
      where: { id: req.params.id },
    });
    if (!quizz) {
      return res.status(404).json({ message: 'Kuis Tidak Ditemukan' });
    }

    // Hapus kuis
    await Quizz.update({ is_deleted: 1 }, { where: { id: quizz.id } });
    res.status(200).json({ message: 'Kuis berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};
export const deleteQuizzPermanent = async (req, res) => {
  const t = await db.transaction();
  try {
    const quizz = await Quizz.findByPk(req.params.id);
    if (!quizz) {
      return res.status(404).json({ message: 'Kuis Tidak Ditemukan' });
    }
    if (quizz.is_active) {
      return res.status(400).json({ message: 'Kuis sedang aktif, tidak dapat dirubah sekarang.' });
    }
    if (quizz.image) {
      try {
        const delImage = await Quizz.findAll({
          where: {
            image: quizz.image,
          },
        });
        if (delImage.length <= 1) {
          const filePath = path.resolve('public', quizz.image);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error('Gagal menghapus gambar kuis:', error);
      }
    }
    const questions = await Question.findAll({
      where: { quiz_id: quizz.id },
      include: [
        {
          model: Option,
          as: 'options',
        },
      ],
      transaction: t,
    });

    for (const q of questions) {
      // Hapus gambar opsi terkait
      for (const opt of q.options) {
        if (opt.image) {
          try {
            const delImage = await Option.findAll({
              where: {
                image: opt.image,
              },
            });
            if (delImage.length <= 1) {
              const filePath = path.resolve('public', opt.image);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error('Gagal menghapus gambar soal:', error);
          }
        }
        await Option.destroy({ where: { id: opt.id }, transaction: t });
      }
      if (q.image) {
        try {
          const delImage = await Question.findAll({
            where: {
              image: q.image,
            },
          });
          if (delImage.length <= 1) {
            const filePath = path.resolve('public', q.image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        } catch (error) {
          console.error('Gagal menghapus gambar soal:', error);
        }
      }
      await Question.destroy({ where: { id: q.id }, transaction: t });
    }
    const studentQuizAttempt = await StudentQuizAttempt.findAll({
      where: { quiz_id: quizz.id },
      include: [
        {
          model: StudentAnswer,
          as: 'studentAnswers',
        },
      ],
      transaction: t,
    });
    for (const q of studentQuizAttempt) {
      // Hapus gambar opsi terkait
      for (const opt of q.studentAnswers) {
        await StudentAnswer.destroy({ where: { attempt_uuid: opt.uuid }, transaction: t });
      }
      // Hapus StudentPointsLog untuk quiz ini, baik source 'quiz: ${quizz.id}' maupun 'recalc_quiz: ${quizz.id}'
      await StudentPointsLog.destroy({
        where: {
          student_id: q.student_user_id,
          source: {
        [Op.or]: [`quiz: ${quizz.id}`, `recalc_quiz: ${quizz.id}`],
          },
        },
        transaction: t,
      });
      const studentRow = await Students.findOne({
        where: { user_id: q.student_user_id },
        transaction: t,
      });
      if (studentRow) {
        await Students.update({ pure_point: studentRow.pure_point - q.score }, { where: { user_id: studentRow.user_id }, transaction: t });
      }
      await StudentQuizAttempt.destroy({ where: { quiz_id: q.quiz_id }, transaction: t });
    }
    await Quizz.destroy({ where: { id: quizz.id }, transaction: t });
    await t.commit();
    res.status(200).json({ message: 'Kuis berhasil dihapus' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const deleteQuizzPhoto = async (req, res) => {
  const t = await db.transaction();
  try {
    const quizz = await Quizz.findOne({
      where: { id: req.params.id },
      transaction: t,
    });

    if (!quizz) {
      await t.rollback();
      return res.status(404).json({ message: 'Kuis tidak ditemukan' });
    }

    if (!quizz.image) {
      await t.rollback();
      return res.status(400).json({ message: 'Kuis tidak memiliki foto untuk dihapus' });
    }

    const filePath = path.resolve('public', quizz.image);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    quizz.image = null;
    await quizz.save({ transaction: t });

    await t.commit();
    res.status(200).json({ message: 'Foto kuis berhasil dihapus' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({
      message: 'Gagal menghapus foto kuis',
      error: err.message,
    });
  }
};
export const uploadQuizzPhoto = async (req, res) => {
  const t = await db.transaction();
  let oldPhotoPath = null;

  try {
    const quizz = await Quizz.findByPk(req.params.id, { transaction: t });
    if (!quizz) {
      await t.rollback();
      return res.status(404).json({ message: 'Kuis tidak ditemukan' });
    }

    if (!req.file) {
      await t.rollback();
      return res.status(400).json({ message: 'File tidak ditemukan' });
    }
    const place = 'quizz';
    const filename = req.file.filename;
    let targetDir = `public/images/${place}`;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const newPath = path.join(targetDir, filename);
    fs.renameSync(req.file.path, newPath);

    // Simpan path lama untuk dihapus nanti
    oldPhotoPath = quizz.image ? path.join('public', quizz.image) : null;

    quizz.image = path.join('images', path.basename(targetDir), filename);
    await quizz.save({ transaction: t });

    await t.commit();

    // Di luar transaksi: hapus foto lama jika ada
    if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }

    res.json({ message: 'Foto berhasil diunggah', photo: quizz.image });
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
export const uploadQuestionImage = async (req, res) => {
  const t = await db.transaction();
  let oldPhotoPath = null;

  try {
    const question = await Question.findByPk(req.params.id, { transaction: t });
    if (!question) {
      await t.rollback();
      return res.status(404).json({ message: 'Soal tidak ditemukan' });
    }

    if (!req.file) {
      await t.rollback();
      return res.status(400).json({ message: 'File tidak ditemukan' });
    }

    const place = 'questions';
    const filename = req.file.filename;
    const targetDir = `public/images/${place}`;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const newPath = path.join(targetDir, filename);
    fs.renameSync(req.file.path, newPath);

    oldPhotoPath = question.image ? path.join('public', question.image) : null;
    question.image = path.join('images', place, filename);
    await question.save({ transaction: t });

    await t.commit();

    if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }

    res.json({ message: 'Gambar soal berhasil diunggah', photo: question.image });
  } catch (err) {
    if (!t.finished) await t.rollback();
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
export const uploadOptionImage = async (req, res) => {
  const t = await db.transaction();
  let oldPhotoPath = null;

  try {
    const option = await Option.findByPk(req.params.id, { transaction: t });
    if (!option) {
      await t.rollback();
      return res.status(404).json({ message: 'Pilihan tidak ditemukan' });
    }

    if (!req.file) {
      await t.rollback();
      return res.status(400).json({ message: 'File tidak ditemukan' });
    }

    const place = 'options';
    const filename = req.file.filename;
    const targetDir = `public/images/${place}`;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const newPath = path.join(targetDir, filename);
    fs.renameSync(req.file.path, newPath);

    oldPhotoPath = option.image ? path.join('public', option.image) : null;
    option.image = path.join('images', place, filename);
    await option.save({ transaction: t });

    await t.commit();

    if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }

    res.json({ message: 'Gambar soal berhasil diunggah', photo: option.image });
  } catch (err) {
    if (!t.finished) await t.rollback();
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const fonts = {
  Roboto: {
    normal: 'fonts/roboto/Roboto-Regular.ttf',
    bold: 'fonts/roboto/Roboto-Medium.ttf',
    italics: 'fonts/roboto/Roboto-Italic.ttf',
    bolditalics: 'fonts/roboto/Roboto-MediumItalic.ttf',
  },
};

export const generateQuizPdf = async (req, res) => {
  try {
    const { study_material, teacher_name, class_name, courses_name, start, student_list } = req.body;

    // Buat instance printer
    const printer = new PdfPrinter(fonts);

    // Header table
    const tableBody = [
      [
        { text: 'No', bold: true },
        { text: 'Nama Siswa', bold: true },
        { text: 'Status', bold: true },
        { text: 'Nilai', bold: true },
        { text: 'Durasi', bold: true },
      ],
    ];

    // Isi data siswa dengan fallback jika null
    student_list.forEach((s, index) => {
      const statusText =
        s.status === 'selesai'
          ? 'Sudah Mengerjakan'
          : s.status === 'belum-mengerjakan'
          ? 'Belum Mengerjakan'
          : s.status === 'sedang-mengerjakan'
          ? 'Sedang Mengerjakan'
          : s.status === 'tidak-mengerjakan'
          ? 'Tidak Mengerjakan'
          : '-';

      tableBody.push([
        { text: `${index + 1}` },
        { text: s.student_name || '-' },
        { text: statusText },
        { text: s.score !== null && s.score !== undefined ? `${s.score}` : '-' },
        { text: s.duration !== null && s.duration !== undefined ? `${s.duration}` : '-' },
      ]);
    });

    const docDefinition = {
      content: [
        { text: `Hasil Kuis: ${study_material} (${courses_name})`, style: 'header' },
        '\n',
        { text: `Guru: ${teacher_name}`, alignment: 'left', margin: [0, 0, 0, 5], style: 'subheader' , fontSize: 12},
        '\n',
        { text: `Kelas: ${class_name}`, alignment: 'left', margin: [0, 0, 0, 5], style: 'subheader' , fontSize: 12},
        '\n',
        { text: `Waktu Kuis Dimulai: ${start}`, alignment: 'left', margin: [0, 0, 0, 5], style: 'subheader' , fontSize: 12},
        '\n',
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto'],
            body: tableBody,
          },
          layout: {
            fillColor: (rowIndex) => {
              return rowIndex === 0 ? '#eeeeee' : null; // Header warna abu
            },
          },
        },
      ],
      styles: {
        header: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
      },
      defaultStyle: { font: 'Roboto', fontSize: 10 },
      pageOrientation: 'portrait',
      pageSize: 'A4',
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Hasil_Kuis_${study_material}.pdf"`
      );
      res.send(pdfBuffer);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal generate PDF' });
  }
};
