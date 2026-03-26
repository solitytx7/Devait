const Course = require('../models/Course');
const { validationResult } = require('express-validator');
const apiResponse = require('../utils/apiResponse');

// Get all courses
const getCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    // Filter by category
    if (req.query.category) {
      filter.category = new RegExp(req.query.category, 'i');
    }
    
    // Filter by level
    if (req.query.level) {
      filter.level = req.query.level;
    }
    
    // Filter by price range
    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
    }
    
    // Filter by published status
    if (req.query.published !== undefined) {
      filter.isPublished = req.query.published === 'true';
    }

    const courses = await Course.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Course.countDocuments(filter);

    res.json(apiResponse.success('Lấy danh sách khóa học thành công', {
      courses,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }));
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi lấy danh sách khóa học'));
  }
};

// Get single course
const getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json(apiResponse.error('Không tìm thấy khóa học'));
    }

    res.json(apiResponse.success('Lấy thông tin khóa học thành công', course));
  } catch (error) {
    console.error('Get course error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json(apiResponse.error('ID khóa học không hợp lệ'));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi lấy thông tin khóa học'));
  }
};

// Create new course
const createCourse = async (req, res) => {
  try {
    
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);
    //Kiểm tra validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json(apiResponse.validationError(errors.array()));
    }

    //Xử lý file uploads
    let imageUrl = req.body.image;
    let videoUrl = req.body.video;
    
    if (req.files) {
      if (req.files.image) {
        imageUrl = `/uploads/images/${req.files.image[0].filename}`;
      }
      if (req.files.video) {
        videoUrl = `/uploads/videos/${req.files.video[0].filename}`;
      }
    }

    // Validate that image and video are provided (either file or URL)
    if (!imageUrl) {
      return res.status(400).json(apiResponse.error('Hình ảnh khóa học là bắt buộc (file hoặc URL)'));
    }
    
    if (!videoUrl) {
      return res.status(400).json(apiResponse.error('Video khóa học là bắt buộc (file hoặc URL)'));
    }

    // Process tags - handle both string and array formats
    let tags = req.body.tags;
    if (typeof tags === 'string' && tags.trim()) {
      tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    } else if (!Array.isArray(tags)) {
      tags = [];
    }

    // Convert isPublished/published to boolean
    let isPublished = req.body.isPublished || req.body.published;
    if (typeof isPublished === 'string') {
      isPublished = isPublished === 'true';
    }
    // Default to true if not specified
    if (isPublished === undefined) {
      isPublished = true;
    }

    const courseData = {
      ...req.body,
      image: imageUrl,
      video: videoUrl,
      tags: tags,
      isPublished: isPublished
    };

    const course = new Course(courseData);
    await course.save();

    res.status(201).json(apiResponse.success('Khóa học đã được tạo thành công', course));
  } catch (error) {
    console.error('Create course error:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json(apiResponse.validationError(validationErrors));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi tạo khóa học'));
  }
};

// Update course
const updateCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(apiResponse.validationError(errors.array()));
    }

    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json(apiResponse.error('Không tìm thấy khóa học'));
    }

    // Handle file uploads
    let updateData = { ...req.body };
    
    if (req.files) {
      if (req.files.image) {
        updateData.image = `/uploads/images/${req.files.image[0].filename}`;
      }
      if (req.files.video) {
        updateData.video = `/uploads/videos/${req.files.video[0].filename}`;
      }
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json(apiResponse.success('Khóa học đã được cập nhật thành công', updatedCourse));
  } catch (error) {
    console.error('Update course error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json(apiResponse.error('ID khóa học không hợp lệ'));
    }
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json(apiResponse.validationError(validationErrors));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi cập nhật khóa học'));
  }
};

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json(apiResponse.error('Không tìm thấy khóa học'));
    }

    await Course.findByIdAndDelete(req.params.id);

    res.json(apiResponse.success('Khóa học đã được xóa thành công'));
  } catch (error) {
    console.error('Delete course error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json(apiResponse.error('ID khóa học không hợp lệ'));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi xóa khóa học'));
  }
};

// Search courses
const searchCourses = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json(apiResponse.error('Từ khóa tìm kiếm không được để trống'));
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const courses = await Course.searchCourses(q.trim())
      .skip(skip)
      .limit(limit);

    const total = await Course.find({
      $text: { $search: q.trim() },
      isPublished: true
    }).countDocuments();

    res.json(apiResponse.success('Tìm kiếm khóa học thành công', {
      courses,
      searchQuery: q.trim(),
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }));
  } catch (error) {
    console.error('Search courses error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi tìm kiếm khóa học'));
  }
};

// Get courses by category
const getCoursesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const courses = await Course.findByCategory(category)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Course.countDocuments({
      category: new RegExp(category, 'i'),
      isPublished: true
    });

    res.json(apiResponse.success(`Lấy khóa học danh mục "${category}" thành công`, {
      courses,
      category,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }));
  } catch (error) {
    console.error('Get courses by category error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi lấy khóa học theo danh mục'));
  }
};

// Get course statistics
const getCourseStats = async (req, res) => {
  try {
    const stats = await Course.aggregate([
      {
        $group: {
          _id: null,
          totalCourses: { $sum: 1 },
          publishedCourses: {
            $sum: { $cond: [{ $eq: ['$isPublished', true] }, 1, 0] }
          },
          totalStudents: { $sum: '$studentsCount' },
          averagePrice: { $avg: '$price' },
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    const categoryStats = await Course.aggregate([
      { $match: { isPublished: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          averagePrice: { $avg: '$price' },
          averageRating: { $avg: '$rating' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json(apiResponse.success('Lấy thống kê khóa học thành công', {
      overview: stats[0] || {
        totalCourses: 0,
        publishedCourses: 0,
        totalStudents: 0,
        averagePrice: 0,
        averageRating: 0
      },
      byCategory: categoryStats
    }));
  } catch (error) {
    console.error('Get course stats error:', error);
    res.status(500).json(apiResponse.error('Lỗi server khi lấy thống kê khóa học'));
  }
};

// Get course with lessons (for course detail view)
const getCourseWithLessons = async (req, res) => {
  try {
    const courseId = req.params.id;
    
    // Get course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json(apiResponse.error('Không tìm thấy khóa học'));
    }
    
    // Check if course is published (unless user is admin/teacher)
    if (!course.isPublished && (!req.user || !['admin', 'teacher'].includes(req.user.role))) {
      return res.status(403).json(apiResponse.error('Khóa học chưa được công bố'));
    }
    
    // Get lessons
    const Lesson = require('../models/Lesson');
    const includeUnpublished = req.user && ['admin', 'teacher'].includes(req.user.role);
    const lessons = await Lesson.findByCourse(courseId, includeUnpublished);
    
    // Check if user is enrolled
    let enrollment = null;
    if (req.user) {
      const Enrollment = require('../models/Enrollment');
      enrollment = await Enrollment.findOne({
        userId: req.user.id,
        courseId: courseId
      });
    }
    
    // Prepare lessons data with access control
    const lessonsData = lessons.map(lesson => {
      const lessonObj = lesson.toObject();
      
      // Check if user has access to this lesson
      let hasAccess = lesson.isFree;
      if (req.user) {
        if (['admin', 'teacher'].includes(req.user.role)) {
          hasAccess = true;
        } else if (enrollment) {
          hasAccess = true;
        }
      }
      
      // Hide video URL and full content if no access
      if (!hasAccess) {
        delete lessonObj.videoUrl;
        delete lessonObj.content;
        delete lessonObj.codeExample;
        delete lessonObj.documents;
        delete lessonObj.quiz;
        lessonObj.locked = true;
      } else {
        lessonObj.locked = false;
      }
      
      // Add completion status if enrolled
      if (enrollment) {
        const completed = enrollment.completedLessons.find(
          cl => cl.lessonId.toString() === lesson._id.toString()
        );
        lessonObj.completed = !!completed;
        lessonObj.completedAt = completed ? completed.completedAt : null;
      }
      
      return lessonObj;
    });
    
    const courseData = course.toObject();
    courseData.lessons = lessonsData;
    courseData.totalLessons = lessons.length;
    courseData.totalDuration = lessons.reduce((sum, lesson) => sum + (lesson.duration || 0), 0);
    
    // Add enrollment info if exists
    if (enrollment) {
      courseData.enrollment = {
        status: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: enrollment.createdAt,
        lastAccessedAt: enrollment.lastAccessedAt,
        completedLessons: enrollment.completedLessons.length
      };
    }
    
    res.json(apiResponse.success('Lấy chi tiết khóa học thành công', courseData));
  } catch (error) {
    console.error('Get course with lessons error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json(apiResponse.error('ID khóa học không hợp lệ'));
    }
    res.status(500).json(apiResponse.error('Lỗi server khi lấy chi tiết khóa học'));
  }
};

module.exports = {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  searchCourses,
  getCoursesByCategory,
  getCourseStats,
  getCourseWithLessons
};