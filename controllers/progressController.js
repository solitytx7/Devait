const Progress = require('../models/Progress');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const progressController = {
  // Lấy tiến độ học tập của một khóa học
  getCourseProgress: async (req, res) => {
    try {
      const { courseId } = req.params;
      const userId = req.user.id;

      // Kiểm tra khóa học có tồn tại
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy khóa học'
        });
      }

      // Lấy tiến độ của tất cả bài học trong khóa học
      const progress = await Progress.getCourseProgress(userId, courseId);
      
      // Lấy tất cả bài học của khóa học
      const allLessons = await Lesson.find({ 
        courseId, 
        isPublished: true 
      }).sort({ order: 1 });

      // Tạo map tiến độ theo lessonId
      const progressMap = {};
      progress.forEach(p => {
        progressMap[p.lessonId._id.toString()] = p;
      });

      // Kết hợp dữ liệu bài học và tiến độ
      const lessonsWithProgress = allLessons.map(lesson => {
        const lessonProgress = progressMap[lesson._id.toString()];
        return {
          lesson: lesson,
          progress: lessonProgress || {
            completed: false,
            watchTime: 0,
            totalWatchTime: 0,
            completionPercentage: 0,
            quizScore: null,
            lastAccessedAt: null
          }
        };
      });

      // Tính phần trăm hoàn thành tổng thể
      const overallCompletion = await Progress.calculateCourseCompletion(userId, courseId);

      res.json({
        success: true,
        data: {
          course: {
            id: course._id,
            name: course.name,
            totalLessons: allLessons.length
          },
          lessons: lessonsWithProgress,
          overallCompletion,
          stats: {
            completedLessons: progress.filter(p => p.completed).length,
            totalWatchTime: progress.reduce((sum, p) => sum + (p.totalWatchTime || 0), 0),
            averageQuizScore: progress.length > 0 ? 
              progress.filter(p => p.quizScore !== null).reduce((sum, p, _, arr) => sum + p.quizScore / arr.length, 0) : 0
          }
        }
      });
    } catch (error) {
      console.error('Get course progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy tiến độ học tập'
      });
    }
  },

  // Cập nhật tiến độ của một bài học
  updateLessonProgress: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array()
        });
      }

      const { lessonId } = req.params;
      const { 
        completed, 
        watchTime, 
        videoPosition, 
        quizScore, 
        quizAttempts 
      } = req.body;
      const userId = req.user.id;

      // Kiểm tra bài học có tồn tại
      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bài học'
        });
      }

      // Chuẩn bị dữ liệu cập nhật
      const updateData = {
        lastAccessedAt: new Date()
      };

      // Cập nhật các trường
      if (completed !== undefined) {
        updateData.completed = completed;
        if (completed) {
          updateData.completedAt = new Date();
        } else {
          updateData.completedAt = null;
        }
      }

      if (watchTime !== undefined) {
        updateData.watchTime = watchTime;
        updateData.$inc = { totalWatchTime: Math.max(0, watchTime - 0) }; // Increment total watch time
      }

      if (quizScore !== undefined) {
        updateData.quizScore = quizScore;
      }

      if (quizAttempts !== undefined) {
        updateData.quizAttempts = quizAttempts;
      }

      // Xử lý videoPosition riêng để tránh conflict
      if (videoPosition !== undefined) {
        updateData['progressDetails.videoPosition'] = videoPosition;
      }

      // Tìm hoặc tạo progress record với upsert
      let progress = await Progress.findOne({ userId, lessonId });
      
      if (!progress) {
        // Tạo mới nếu chưa tồn tại
        progress = new Progress({
          userId,
          lessonId,
          courseId: lesson.courseId,
          progressDetails: {
            startedAt: new Date(),
            videoPaused: false,
            videoPosition: videoPosition || 0,
            bookmarked: false
          },
          ...updateData
        });
        await progress.save();
      } else {
        // Update existing record
        Object.keys(updateData).forEach(key => {
          if (key.includes('.')) {
            // Handle nested updates
            const [parent, child] = key.split('.');
            if (!progress[parent]) progress[parent] = {};
            progress[parent][child] = updateData[key];
          } else {
            progress[key] = updateData[key];
          }
        });
        
        // Handle $inc operation manually
        if (updateData.$inc) {
          Object.keys(updateData.$inc).forEach(key => {
            progress[key] = (progress[key] || 0) + updateData.$inc[key];
          });
        }
        
        await progress.save();
      }

      // Populate thông tin bài học
      await progress.populate('lessonId', 'title duration order');

      res.json({
        success: true,
        message: 'Cập nhật tiến độ thành công',
        data: progress
      });
    } catch (error) {
      console.error('Update lesson progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi cập nhật tiến độ'
      });
    }
  },

  // Lấy thống kê học tập tổng quan của user
  getUserStats: async (req, res) => {
    try {
      const userId = req.user.id;
      const { courseId } = req.query;

      let stats;
      
      if (courseId) {
        // Thống kê cho một khóa học cụ thể
        const courseProgress = await Progress.getCourseProgress(userId, courseId);
        const course = await Course.findById(courseId);
        const totalLessons = await Lesson.countDocuments({ 
          courseId, 
          isPublished: true 
        });
        
        const completedLessons = courseProgress.filter(p => p.completed).length;
        const totalWatchTime = courseProgress.reduce((sum, p) => sum + (p.totalWatchTime || 0), 0);
        const quizScores = courseProgress.filter(p => p.quizScore !== null).map(p => p.quizScore);
        
        stats = {
          course: course,
          totalLessons,
          completedLessons,
          completionPercentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
          totalWatchTime,
          formattedWatchTime: formatWatchTime(totalWatchTime),
          averageQuizScore: quizScores.length > 0 ? 
            Math.round(quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length) : null,
          totalQuizzes: quizScores.length,
          lastAccessed: courseProgress.length > 0 ? 
            Math.max(...courseProgress.map(p => new Date(p.lastAccessedAt))) : null
        };
      } else {
        // Thống kê tổng quan tất cả khóa học
        const overallStats = await Progress.getOverallStats(userId);
        const learningStats = await Progress.getUserLearningStats(userId);

        stats = {
          ...overallStats,
          formattedWatchTime: formatWatchTime(overallStats.totalWatchTime),
          averageQuizScore: overallStats.averageQuizScore ? 
            Math.round(overallStats.averageQuizScore) : null,
          courses: learningStats.map(course => ({
            ...course,
            formattedWatchTime: formatWatchTime(course.totalWatchTime),
            averageQuizScore: course.averageQuizScore ? 
              Math.round(course.averageQuizScore) : null
          }))
        };
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thống kê học tập'
      });
    }
  },

  // Lấy danh sách bài học gần đây
  getRecentLessons: async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;

      const recentProgress = await Progress.find({ userId })
        .sort({ lastAccessedAt: -1 })
        .limit(parseInt(limit))
        .populate('lessonId', 'title duration order videoUrl')
        .populate('courseId', 'name category instructor');

      const recentLessons = recentProgress.map(progress => ({
        progress,
        lesson: progress.lessonId,
        course: progress.courseId
      }));

      res.json({
        success: true,
        data: recentLessons
      });
    } catch (error) {
      console.error('Get recent lessons error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy bài học gần đây'
      });
    }
  },

  // Đánh dấu yêu thích bài học
  toggleBookmark: async (req, res) => {
    try {
      const { lessonId } = req.params;
      const userId = req.user.id;

      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bài học'
        });
      }

      let progress = await Progress.findOne({
        userId,
        courseId: lesson.courseId,
        lessonId
      });

      if (!progress) {
        progress = new Progress({
          userId,
          courseId: lesson.courseId,
          lessonId,
          progressDetails: {
            startedAt: new Date(),
            bookmarked: true
          }
        });
      } else {
        progress.progressDetails.bookmarked = !progress.progressDetails.bookmarked;
      }

      await progress.save();

      res.json({
        success: true,
        message: progress.progressDetails.bookmarked ? 
          'Đã thêm vào yêu thích' : 'Đã bỏ khỏi yêu thích',
        data: {
          bookmarked: progress.progressDetails.bookmarked
        }
      });
    } catch (error) {
      console.error('Toggle bookmark error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi cập nhật yêu thích'
      });
    }
  },

  // Lấy danh sách bài học yêu thích
  getBookmarkedLessons: async (req, res) => {
    try {
      const userId = req.user.id;

      const bookmarkedProgress = await Progress.find({
        userId,
        'progressDetails.bookmarked': true
      })
      .sort({ lastAccessedAt: -1 })
      .populate('lessonId', 'title duration order videoUrl')
      .populate('courseId', 'name category instructor');

      const bookmarkedLessons = bookmarkedProgress.map(progress => ({
        progress,
        lesson: progress.lessonId,
        course: progress.courseId
      }));

      res.json({
        success: true,
        data: bookmarkedLessons
      });
    } catch (error) {
      console.error('Get bookmarked lessons error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy bài học yêu thích'
      });
    }
  },

  // Reset tiến độ khóa học
  resetCourseProgress: async (req, res) => {
    try {
      const { courseId } = req.params;
      const userId = req.user.id;

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy khóa học'
        });
      }

      await Progress.deleteMany({ userId, courseId });

      res.json({
        success: true,
        message: 'Đã reset tiến độ khóa học thành công'
      });
    } catch (error) {
      console.error('Reset course progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi reset tiến độ'
      });
    }
  }
};

// Helper function để format thời gian
function formatWatchTime(totalSeconds) {
  if (!totalSeconds) return '0 phút';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes} phút`;
  }
}

module.exports = progressController;