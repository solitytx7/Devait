const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tiêu đề bài học là bắt buộc'],
    trim: true,
    maxlength: [200, 'Tiêu đề không được quá 200 ký tự']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Mô tả không được quá 1000 ký tự']
  },
  content: {
    type: String,
    trim: true
  },
  videoUrl: {
    type: String,
    trim: true
  },
  codeExample: {
    language: {
      type: String,
      default: 'javascript'
    },
    code: {
      type: String,
      trim: true
    }
  },
  documents: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['pdf', 'doc', 'ppt', 'link', 'other'],
      default: 'other'
    }
  }],
  duration: {
    type: Number, // in minutes
    default: 10,
    min: [1, 'Thời lượng phải ít nhất 1 phút']
  },
  order: {
    type: Number,
    required: [true, 'Thứ tự bài học là bắt buộc'],
    min: [1, 'Thứ tự phải từ 1 trở lên']
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'ID khóa học là bắt buộc']
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  isFree: {
    type: Boolean,
    default: false
  },
  quiz: {
    questions: [{
      question: {
        type: String,
        required: true,
        trim: true
      },
      options: [{
        type: String,
        required: true,
        trim: true
      }],
      correctAnswer: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    passingScore: {
      type: Number,
      default: 70,
      min: 0,
      max: 100
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
lessonSchema.index({ courseId: 1, order: 1 });
lessonSchema.index({ courseId: 1, isPublished: 1 });

// Virtual for formatted duration
lessonSchema.virtual('formattedDuration').get(function() {
  if (this.duration < 60) {
    return `${this.duration}m`;
  }
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
});

// Virtual for video file compatibility
lessonSchema.virtual('videoFile').get(function() {
  return this.videoUrl;
});

// Static method to get lessons by course
lessonSchema.statics.findByCourse = function(courseId, includeUnpublished = false) {
  const filter = { courseId };
  if (!includeUnpublished) {
    filter.isPublished = true;
  }
  return this.find(filter).sort({ order: 1 });
};

// Static method to get next lesson
lessonSchema.statics.getNextLesson = function(courseId, currentOrder) {
  return this.findOne({
    courseId,
    order: { $gt: currentOrder },
    isPublished: true
  }).sort({ order: 1 });
};

// Static method to get previous lesson
lessonSchema.statics.getPreviousLesson = function(courseId, currentOrder) {
  return this.findOne({
    courseId,
    order: { $lt: currentOrder },
    isPublished: true
  }).sort({ order: -1 });
};

module.exports = mongoose.model('Lesson', lessonSchema);