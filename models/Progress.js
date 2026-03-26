const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID là bắt buộc']
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course ID là bắt buộc']
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: [true, 'Lesson ID là bắt buộc']
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  watchTime: {
    type: Number, // thời gian xem video tính bằng giây
    default: 0,
    min: [0, 'Thời gian xem không thể âm']
  },
  totalWatchTime: {
    type: Number, // tổng thời gian đã xem bài học này
    default: 0,
    min: [0, 'Tổng thời gian xem không thể âm']
  },
  quizScore: {
    type: Number, // điểm quiz của bài học (nếu có)
    default: null,
    min: [0, 'Điểm số không thể âm'],
    max: [100, 'Điểm số không thể lớn hơn 100']
  },
  quizAttempts: {
    type: Number, // số lần làm quiz
    default: 0,
    min: [0, 'Số lần thử không thể âm']
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  // Lưu trữ thông tin chi tiết về tiến độ
  progressDetails: {
    startedAt: {
      type: Date,
      default: null
    },
    videoPaused: {
      type: Boolean,
      default: false
    },
    videoPosition: {
      type: Number, // vị trí dừng video (giây)
      default: 0
    },
    bookmarked: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index để tối ưu hóa truy vấn
progressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
progressSchema.index({ userId: 1, courseId: 1 });
progressSchema.index({ userId: 1, completed: 1 });
progressSchema.index({ courseId: 1, completed: 1 });

// Virtual để tính phần trăm hoàn thành của bài học
progressSchema.virtual('completionPercentage').get(function() {
  if (this.completed) return 100;
  if (!this.watchTime || !this.lesson?.duration) return 0;
  
  const lessonDurationSeconds = (this.lesson.duration || 0) * 60; // chuyển phút sang giây
  const percentage = Math.min(100, (this.watchTime / lessonDurationSeconds) * 100);
  return Math.round(percentage);
});

// Virtual để format thời gian xem
progressSchema.virtual('formattedWatchTime').get(function() {
  if (!this.totalWatchTime) return '0 phút';
  
  const hours = Math.floor(this.totalWatchTime / 3600);
  const minutes = Math.floor((this.totalWatchTime % 3600) / 60);
  const seconds = this.totalWatchTime % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
});

// Middleware để cập nhật completedAt khi completed = true
progressSchema.pre('save', function(next) {
  if (this.completed && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  if (!this.completed && this.completedAt) {
    this.completedAt = null;
  }
  
  // Cập nhật lastAccessedAt
  this.lastAccessedAt = new Date();
  
  next();
});

// Static method để lấy tiến độ theo khóa học
progressSchema.statics.getCourseProgress = async function(userId, courseId) {
  return this.find({ userId, courseId })
    .populate('lessonId', 'title duration order')
    .sort({ 'lessonId.order': 1 });
};

// Static method để tính phần trăm hoàn thành khóa học
progressSchema.statics.calculateCourseCompletion = async function(userId, courseId) {
  const Lesson = mongoose.model('Lesson');
  
  // Lấy tất cả bài học của khóa học
  const totalLessons = await Lesson.countDocuments({ courseId, isPublished: true });
  
  if (totalLessons === 0) return 0;
  
  // Lấy số bài học đã hoàn thành
  const completedLessons = await this.countDocuments({ 
    userId, 
    courseId, 
    completed: true 
  });
  
  return Math.round((completedLessons / totalLessons) * 100);
};

// Static method để lấy thống kê học tập của user
progressSchema.statics.getUserLearningStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$courseId',
        totalLessons: { $sum: 1 },
        completedLessons: { 
          $sum: { $cond: [{ $eq: ['$completed', true] }, 1, 0] } 
        },
        totalWatchTime: { $sum: '$totalWatchTime' },
        averageQuizScore: { 
          $avg: { 
            $cond: [
              { $ne: ['$quizScore', null] }, 
              '$quizScore', 
              null 
            ] 
          } 
        },
        lastAccessed: { $max: '$lastAccessedAt' }
      }
    },
    {
      $addFields: {
        completionPercentage: {
          $round: [
            { $multiply: [
              { $divide: ['$completedLessons', '$totalLessons'] }, 
              100 
            ]}, 
            0
          ]
        }
      }
    },
    {
      $lookup: {
        from: 'courses',
        localField: '_id',
        foreignField: '_id',
        as: 'course'
      }
    },
    { $unwind: '$course' }
  ]);
  
  return stats;
};

// Static method để lấy tiến độ học tập tổng quan
progressSchema.statics.getOverallStats = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalCourses: { $addToSet: '$courseId' },
        totalLessons: { $sum: 1 },
        completedLessons: { 
          $sum: { $cond: [{ $eq: ['$completed', true] }, 1, 0] } 
        },
        totalWatchTime: { $sum: '$totalWatchTime' },
        totalQuizzes: { 
          $sum: { $cond: [{ $ne: ['$quizScore', null] }, 1, 0] } 
        },
        averageQuizScore: { 
          $avg: { 
            $cond: [
              { $ne: ['$quizScore', null] }, 
              '$quizScore', 
              null 
            ] 
          } 
        }
      }
    },
    {
      $addFields: {
        totalCourses: { $size: '$totalCourses' },
        overallCompletion: {
          $round: [
            { $multiply: [
              { $divide: ['$completedLessons', '$totalLessons'] }, 
              100 
            ]}, 
            0
          ]
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalCourses: 0,
    totalLessons: 0,
    completedLessons: 0,
    totalWatchTime: 0,
    totalQuizzes: 0,
    averageQuizScore: null,
    overallCompletion: 0
  };
};

module.exports = mongoose.model('Progress', progressSchema);