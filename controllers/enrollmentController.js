const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const { validationResult } = require('express-validator');
const apiResponse = require('../utils/apiResponse');

// Enroll in a course
const enrollInCourse = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('Bạn cần đăng nhập để đăng ký khóa học'));
    }
    
    // Support both body and params for courseId
    const courseId = req.params.courseId || req.body.courseId;
    
    if (!courseId) {
      return res.status(400).json(apiResponse.error('ID khóa học là bắt buộc'));
    }
    
    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json(apiResponse.error('Không tìm thấy khóa học'));
    }
    
    if (!course.isPublished) {
      return res.status(400).json(apiResponse.error('Khóa học chưa được công bố'));
    }
    
    // Check if user is already enrolled
    const existingEnrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: courseId
    });
    
    if (existingEnrollment) {
      if (existingEnrollment.status === 'cancelled') {
        // Reactivate cancelled enrollment
        existingEnrollment.status = 'active';
        existingEnrollment.lastAccessedAt = new Date();
        await existingEnrollment.save();
        
        return res.json(apiResponse.success('Đã kích hoạt lại đăng ký khóa học', existingEnrollment));
      } else {
        return res.status(400).json(apiResponse.error('Bạn đã đăng ký khóa học này rồi'));
      }
    }
    
    // Create new enrollment
    const enrollment = new Enrollment({
      userId: req.user.id,
      courseId: courseId,
      status: 'active'
    });
    
    await enrollment.save();
    
    // Update course student count
    await Course.findByIdAndUpdate(courseId, {
      $inc: { studentsCount: 1 }
    });
    
    // Populate course information
    await enrollment.populate('courseId', 'name description image instructor rating duration price');
    
    res.status(201).json(apiResponse.success('Đăng ký khóa học thành công', enrollment));
  } catch (error) {
    console.error('Enroll in course error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json(apiResponse.error('ID khóa học không hợp lệ'));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi đăng ký khóa học'));
  }
};

// Get user's enrollments
const getUserEnrollments = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('Bạn cần đăng nhập để xem danh sách khóa học'));
    }
    
    const { status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = { userId: req.user.id };
    if (status && ['active', 'completed', 'suspended', 'cancelled'].includes(status)) {
      filter.status = status;
    }
    
    const enrollments = await Enrollment.find(filter)
      .populate('courseId', 'name description image instructor rating duration price category')
      .sort({ lastAccessedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Enrollment.countDocuments(filter);
    
    res.json(apiResponse.success('Lấy danh sách khóa học đã đăng ký thành công', {
      enrollments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }));
  } catch (error) {
    console.error('Get user enrollments error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi lấy danh sách khóa học đã đăng ký'));
  }
};

// Get enrollment details
const getEnrollmentDetails = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('Bạn cần đăng nhập để xem chi tiết đăng ký'));
    }
    
    const { courseId } = req.params;
    
    const enrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: courseId
    })
    .populate('courseId', 'name description image instructor rating duration price')
    .populate('completedLessons.lessonId', 'title order duration')
    .populate('lastAccessedLesson', 'title order');
    
    if (!enrollment) {
      return res.status(404).json(apiResponse.error('Không tìm thấy thông tin đăng ký'));
    }
    
    // Get course lessons for progress calculation
    const totalLessons = await Lesson.countDocuments({
      courseId: courseId,
      isPublished: true
    });
    
    const enrollmentData = enrollment.toObject();
    enrollmentData.totalLessons = totalLessons;
    enrollmentData.completedLessonsCount = enrollment.completedLessons.length;
    
    res.json(apiResponse.success('Lấy chi tiết đăng ký thành công', enrollmentData));
  } catch (error) {
    console.error('Get enrollment details error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json(apiResponse.error('ID khóa học không hợp lệ'));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi lấy chi tiết đăng ký'));
  }
};

// Update learning progress
const updateProgress = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('Bạn cần đăng nhập để cập nhật tiến trình'));
    }
    
    const { courseId } = req.params;
    const { lessonId, timeSpent = 0 } = req.body;
    
    const enrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: courseId
    });
    
    if (!enrollment) {
      return res.status(404).json(apiResponse.error('Không tìm thấy thông tin đăng ký'));
    }
    
    // Update last accessed lesson and time
    if (lessonId) {
      const lesson = await Lesson.findById(lessonId);
      if (lesson && lesson.courseId.toString() === courseId) {
        enrollment.lastAccessedLesson = lessonId;
      }
    }
    
    enrollment.lastAccessedAt = new Date();
    if (timeSpent > 0) {
      enrollment.totalTimeSpent += timeSpent;
    }
    
    await enrollment.save();
    
    res.json(apiResponse.success('Cập nhật tiến trình thành công', {
      progress: enrollment.progress,
      lastAccessedAt: enrollment.lastAccessedAt,
      totalTimeSpent: enrollment.totalTimeSpent
    }));
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi cập nhật tiến trình'));
  }
};

// Cancel enrollment
const cancelEnrollment = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('Bạn cần đăng nhập để hủy đăng ký'));
    }
    
    const { courseId } = req.params;
    
    const enrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: courseId
    });
    
    if (!enrollment) {
      return res.status(404).json(apiResponse.error('Không tìm thấy thông tin đăng ký'));
    }
    
    if (enrollment.status === 'completed') {
      return res.status(400).json(apiResponse.error('Không thể hủy khóa học đã hoàn thành'));
    }
    
    enrollment.status = 'cancelled';
    await enrollment.save();
    
    // Update course student count
    await Course.findByIdAndUpdate(courseId, {
      $inc: { studentsCount: -1 }
    });
    
    res.json(apiResponse.success('Hủy đăng ký khóa học thành công'));
  } catch (error) {
    console.error('Cancel enrollment error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi hủy đăng ký'));
  }
};

// Get course enrollments (Admin/Teacher only)
const getCourseEnrollments = async (req, res) => {
  try {
    if (!req.user || !['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json(apiResponse.error('Bạn không có quyền xem danh sách học viên'));
    }
    
    const { courseId } = req.params;
    const { status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = { courseId };
    if (status && ['active', 'completed', 'suspended', 'cancelled'].includes(status)) {
      filter.status = status;
    }
    
    const enrollments = await Enrollment.find(filter)
      .populate('userId', 'name email avatar createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Enrollment.countDocuments(filter);
    
    // Get course info
    const course = await Course.findById(courseId, 'name description instructor');
    
    res.json(apiResponse.success('Lấy danh sách học viên thành công', {
      enrollments,
      course,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }));
  } catch (error) {
    console.error('Get course enrollments error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi lấy danh sách học viên'));
  }
};

// Get enrollment statistics
const getEnrollmentStats = async (req, res) => {
  try {
    if (!req.user || !['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json(apiResponse.error('Bạn không có quyền xem thống kê'));
    }
    
    const stats = await Enrollment.aggregate([
      {
        $group: {
          _id: null,
          totalEnrollments: { $sum: 1 },
          activeEnrollments: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          completedEnrollments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledEnrollments: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          averageProgress: { $avg: '$progress' },
          totalTimeSpent: { $sum: '$totalTimeSpent' }
        }
      }
    ]);
    
    const courseStats = await Enrollment.aggregate([
      { $match: { status: { $in: ['active', 'completed'] } } },
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: '$course' },
      {
        $group: {
          _id: '$courseId',
          courseName: { $first: '$course.name' },
          enrollmentCount: { $sum: 1 },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          averageProgress: { $avg: '$progress' },
          totalTimeSpent: { $sum: '$totalTimeSpent' }
        }
      },
      { $sort: { enrollmentCount: -1 } },
      { $limit: 10 }
    ]);
    
    res.json(apiResponse.success('Lấy thống kê đăng ký thành công', {
      overview: stats[0] || {
        totalEnrollments: 0,
        activeEnrollments: 0,
        completedEnrollments: 0,
        cancelledEnrollments: 0,
        averageProgress: 0,
        totalTimeSpent: 0
      },
      topCourses: courseStats
    }));
  } catch (error) {
    console.error('Get enrollment stats error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi lấy thống kê đăng ký'));
  }
};

// Delete user note
const deleteNote = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('Bạn cần đăng nhập để xóa ghi chú'));
    }
    
    const { courseId, noteId } = req.params;
    
    const enrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: courseId
    });
    
    if (!enrollment) {
      return res.status(404).json(apiResponse.error('Không tìm thấy thông tin đăng ký'));
    }
    
    const noteIndex = enrollment.notes.findIndex(
      note => note._id.toString() === noteId
    );
    
    if (noteIndex === -1) {
      return res.status(404).json(apiResponse.error('Không tìm thấy ghi chú'));
    }
    
    enrollment.notes.splice(noteIndex, 1);
    await enrollment.save();
    
    res.json(apiResponse.success('Xóa ghi chú thành công'));
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi xóa ghi chú'));
  }
};

module.exports = {
  enrollInCourse,
  getUserEnrollments,
  getEnrollmentDetails,
  updateProgress,
  cancelEnrollment,
  getCourseEnrollments,
  getEnrollmentStats,
  deleteNote
};