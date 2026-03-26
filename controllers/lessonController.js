const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { validationResult } = require('express-validator');
const apiResponse = require('../utils/apiResponse');

// Get all lessons (Admin/Teacher)
const getAllLessons = async (req, res) => {
  try {
    const includeUnpublished = req.user && ['admin', 'teacher'].includes(req.user.role);
    
    let query = {};
    if (!includeUnpublished) {
      query.isPublished = true;
    }
    
    const lessons = await Lesson.find(query)
      .populate('courseId', 'name description')
      .sort({ createdAt: -1 });
    
    res.json(apiResponse.success('Lấy danh sách bài học thành công', {
      lessons: lessons,
      total: lessons.length
    }));
  } catch (error) {
    console.error('Get all lessons error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi lấy danh sách bài học'));
  }
};

// Get all lessons for a course
const getLessonsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const includeUnpublished = req.user && ['admin', 'teacher'].includes(req.user.role);
    
    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json(apiResponse.error('Không tìm thấy khóa học'));
    }
    
    const lessons = await Lesson.findByCourse(courseId, includeUnpublished);
    
    // If user is enrolled, get their progress
    let enrollment = null;
    if (req.user) {
      enrollment = await Enrollment.findOne({
        userId: req.user.id,
        courseId: courseId
      });
    }
    
    // Add completion status to lessons
    const lessonsWithProgress = lessons.map(lesson => {
      const lessonObj = lesson.toObject();
      if (enrollment) {
        const completed = enrollment.completedLessons.find(
          cl => cl.lessonId.toString() === lesson._id.toString()
        );
        lessonObj.completed = !!completed;
        lessonObj.completedAt = completed ? completed.completedAt : null;
        lessonObj.quizScore = completed ? completed.quizScore : null;
      } else {
        lessonObj.completed = false;
      }
      return lessonObj;
    });

    res.json(apiResponse.success('Lấy danh sách bài học thành công', {
      lessons: lessonsWithProgress,
      course: {
        id: course._id,
        name: course.name,
        description: course.description
      },
      enrollment: enrollment ? {
        progress: enrollment.progress,
        status: enrollment.status,
        totalTimeSpent: enrollment.totalTimeSpent
      } : null
    }));
  } catch (error) {
    console.error('Get lessons by course error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json(apiResponse.error('ID khóa học không hợp lệ'));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi lấy danh sách bài học'));
  }
};

// Get single lesson
const getLesson = async (req, res) => {
  try {
    const { id } = req.params;
    
    const lesson = await Lesson.findById(id).populate('courseId', 'name description instructor');
    
    if (!lesson) {
      return res.status(404).json(apiResponse.error('Không tìm thấy bài học'));
    }
    
    // Check if user has access to this lesson
    let hasAccess = lesson.isFree || lesson.isPublished === false;
    let enrollment = null;
    
    if (req.user) {
      // Check if user is admin/teacher or enrolled in course
      if (['admin', 'teacher'].includes(req.user.role)) {
        hasAccess = true;
      } else {
        enrollment = await Enrollment.findOne({
          userId: req.user.id,
          courseId: lesson.courseId._id,
          status: { $in: ['active', 'completed'] }
        });
        hasAccess = !!enrollment;
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json(apiResponse.error('Bạn cần đăng ký khóa học để xem bài học này'));
    }
    
    // Get user's notes for this lesson
    let userNotes = [];
    if (enrollment) {
      userNotes = enrollment.notes.filter(
        note => note.lessonId.toString() === lesson._id.toString()
      );
    }
    
    // Get next and previous lessons
    const nextLesson = await Lesson.getNextLesson(lesson.courseId._id, lesson.order);
    const previousLesson = await Lesson.getPreviousLesson(lesson.courseId._id, lesson.order);
    
    const lessonData = lesson.toObject();
    lessonData.userNotes = userNotes;
    lessonData.navigation = {
      previous: previousLesson ? {
        id: previousLesson._id,
        title: previousLesson.title,
        order: previousLesson.order
      } : null,
      next: nextLesson ? {
        id: nextLesson._id,
        title: nextLesson.title,
        order: nextLesson.order
      } : null
    };
    
    res.json(apiResponse.success('Lấy thông tin bài học thành công', lessonData));
  } catch (error) {
    console.error('Get lesson error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json(apiResponse.error('ID bài học không hợp lệ'));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi lấy thông tin bài học'));
  }
};

// Create new lesson (Admin/Teacher only)
const createLesson = async (req, res) => {
  try {
    // Check permission
    if (!req.user || !['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json(apiResponse.error('Bạn không có quyền tạo bài học'));
    }
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(apiResponse.validationError(errors.array()));
    }
    
    // Get courseId from either courseId or course field
    const courseId = req.body.courseId || req.body.course;
    
    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json(apiResponse.error('Không tìm thấy khóa học'));
    }
    
    // Handle file uploads for video
    let videoUrl = req.body.videoUrl;
    if (req.file && req.file.fieldname === 'video') {
      videoUrl = `/uploads/videos/${req.file.filename}`;
    }
    
    // Process documents
    let documents = [];
    if (req.body.documents) {
      try {
        documents = typeof req.body.documents === 'string' 
          ? JSON.parse(req.body.documents) 
          : req.body.documents;
      } catch (error) {
        documents = [];
      }
    }
    
    // Process code example
    let codeExample = {};
    if (req.body.codeLanguage && req.body.codeContent) {
      codeExample = {
        language: req.body.codeLanguage,
        code: req.body.codeContent
      };
    }
    
    // Process quiz
    let quiz = {};
    if (req.body.quizQuestions) {
      try {
        const questions = typeof req.body.quizQuestions === 'string' 
          ? JSON.parse(req.body.quizQuestions) 
          : req.body.quizQuestions;
        quiz = {
          questions: questions,
          passingScore: req.body.quizPassingScore || 70
        };
      } catch (error) {
        quiz = {};
      }
    }
    
    const lessonData = {
      ...req.body,
      courseId,  // Use normalized courseId
      videoUrl,
      documents,
      codeExample: Object.keys(codeExample).length > 0 ? codeExample : undefined,
      quiz: Object.keys(quiz).length > 0 ? quiz : undefined
    };
    
    const lesson = new Lesson(lessonData);
    await lesson.save();
    
    res.status(201).json(apiResponse.success('Bài học đã được tạo thành công', lesson));
  } catch (error) {
    console.error('Create lesson error:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json(apiResponse.validationError(validationErrors));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi tạo bài học'));
  }
};

// Update lesson (Admin/Teacher only)
const updateLesson = async (req, res) => {
  try {
    // Check permission
    if (!req.user || !['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json(apiResponse.error('Bạn không có quyền cập nhật bài học'));
    }
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(apiResponse.validationError(errors.array()));
    }
    
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json(apiResponse.error('Không tìm thấy bài học'));
    }
    
    // Handle file uploads
    let updateData = { ...req.body };
    
    // Normalize courseId
    if (req.body.course && !req.body.courseId) {
      updateData.courseId = req.body.course;
    }
    
    if (req.file && req.file.fieldname === 'video') {
      updateData.videoUrl = `/uploads/videos/${req.file.filename}`;
    }
    
    const updatedLesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.json(apiResponse.success('Bài học đã được cập nhật thành công', updatedLesson));
  } catch (error) {
    console.error('Update lesson error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json(apiResponse.error('ID bài học không hợp lệ'));
    }
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json(apiResponse.validationError(validationErrors));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi cập nhật bài học'));
  }
};

// Delete lesson (Admin/Teacher only)
const deleteLesson = async (req, res) => {
  try {
    // Check permission
    if (!req.user || !['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json(apiResponse.error('Bạn không có quyền xóa bài học'));
    }
    
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json(apiResponse.error('Không tìm thấy bài học'));
    }
    
    await Lesson.findByIdAndDelete(req.params.id);
    
    res.json(apiResponse.success('Bài học đã được xóa thành công'));
  } catch (error) {
    console.error('Delete lesson error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json(apiResponse.error('ID bài học không hợp lệ'));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi xóa bài học'));
  }
};

// Mark lesson as completed
const completeLesson = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('Bạn cần đăng nhập để thực hiện chức năng này'));
    }
    
    const { id } = req.params;
    const { timeSpent = 0, quizScore = null } = req.body;
    
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json(apiResponse.error('Không tìm thấy bài học'));
    }
    
    // Check if user is enrolled
    let enrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: lesson.courseId,
      status: { $in: ['active', 'completed'] }
    });
    
    if (!enrollment) {
      return res.status(403).json(apiResponse.error('Bạn cần đăng ký khóa học để thực hiện chức năng này'));
    }
    
    // Mark lesson as completed
    enrollment.completeLesson(lesson._id, timeSpent, quizScore);
    await enrollment.updateProgress();
    await enrollment.save();
    
    res.json(apiResponse.success('Đã đánh dấu bài học hoàn thành', {
      lessonId: lesson._id,
      progress: enrollment.progress,
      status: enrollment.status,
      completedLessons: enrollment.completedLessons.length
    }));
  } catch (error) {
    console.error('Complete lesson error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi đánh dấu bài học hoàn thành'));
  }
};

// Add note to lesson
const addNote = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('Bạn cần đăng nhập để thực hiện chức năng này'));
    }
    
    const { id } = req.params;
    const { content, timestamp = 0 } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json(apiResponse.error('Nội dung ghi chú không được để trống'));
    }
    
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json(apiResponse.error('Không tìm thấy bài học'));
    }
    
    // Check if user is enrolled
    let enrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: lesson.courseId
    });
    
    if (!enrollment) {
      return res.status(403).json(apiResponse.error('Bạn cần đăng ký khóa học để thực hiện chức năng này'));
    }
    
    // Add note
    enrollment.addNote(lesson._id, content.trim(), timestamp);
    await enrollment.save();
    
    // Get the newly added note
    const newNote = enrollment.notes[enrollment.notes.length - 1];
    
    res.json(apiResponse.success('Ghi chú đã được thêm thành công', {
      note: newNote,
      totalNotes: enrollment.notes.filter(n => n.lessonId.toString() === lesson._id.toString()).length
    }));
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi thêm ghi chú'));
  }
};

// Get user notes for a lesson
const getLessonNotes = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('Bạn cần đăng nhập để xem ghi chú'));
    }
    
    const { id } = req.params;
    
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json(apiResponse.error('Không tìm thấy bài học'));
    }
    
    const enrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: lesson.courseId
    });
    
    if (!enrollment) {
      return res.json(apiResponse.success('Lấy danh sách ghi chú thành công', { notes: [] }));
    }
    
    const notes = enrollment.notes.filter(
      note => note.lessonId.toString() === lesson._id.toString()
    ).sort({ createdAt: -1 });
    
    res.json(apiResponse.success('Lấy danh sách ghi chú thành công', { notes }));
  } catch (error) {
    console.error('Get lesson notes error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi lấy danh sách ghi chú'));
  }
};

module.exports = {
  getAllLessons,
  getLessonsByCourse,
  getLesson,
  createLesson,
  updateLesson,
  deleteLesson,
  completeLesson,
  addNote,
  getLessonNotes
};