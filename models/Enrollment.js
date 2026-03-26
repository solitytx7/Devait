const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['active', 'completed', 'suspended', 'cancelled'],
    default: 'active'
  },
  progress: {
    type: Number,
    default: 0,
    min: [0, 'Tiến trình không thể âm'],
    max: [100, 'Tiến trình không thể vượt quá 100%']
  },
  completedLessons: [{
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    timeSpent: {
      type: Number, // in minutes
      default: 0
    },
    quizScore: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  notes: [{
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, 'Ghi chú không được quá 2000 ký tự']
    },
    timestamp: {
      type: Number, // Video timestamp in seconds
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastAccessedLesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  totalTimeSpent: {
    type: Number, // in minutes
    default: 0
  },
  certificate: {
    issued: {
      type: Boolean,
      default: false
    },
    issuedAt: Date,
    certificateUrl: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for efficient queries
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ userId: 1, status: 1 });
enrollmentSchema.index({ courseId: 1, status: 1 });

// Virtual for completion percentage
enrollmentSchema.virtual('completionPercentage').get(function() {
  return Math.round(this.progress);
});

// Virtual for formatted time spent
enrollmentSchema.virtual('formattedTimeSpent').get(function() {
  if (this.totalTimeSpent < 60) {
    return `${this.totalTimeSpent}m`;
  }
  const hours = Math.floor(this.totalTimeSpent / 60);
  const minutes = this.totalTimeSpent % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
});

// Method to mark lesson as completed
enrollmentSchema.methods.completeLesson = function(lessonId, timeSpent = 0, quizScore = null) {
  const existingIndex = this.completedLessons.findIndex(
    cl => cl.lessonId.toString() === lessonId.toString()
  );
  
  if (existingIndex === -1) {
    this.completedLessons.push({
      lessonId,
      completedAt: new Date(),
      timeSpent,
      quizScore
    });
  } else {
    // Update existing completion
    this.completedLessons[existingIndex].timeSpent += timeSpent;
    if (quizScore !== null) {
      this.completedLessons[existingIndex].quizScore = Math.max(
        this.completedLessons[existingIndex].quizScore || 0,
        quizScore
      );
    }
  }
  
  this.totalTimeSpent += timeSpent;
  this.lastAccessedLesson = lessonId;
  this.lastAccessedAt = new Date();
};

// Method to add note
enrollmentSchema.methods.addNote = function(lessonId, content, timestamp = 0) {
  this.notes.push({
    lessonId,
    content,
    timestamp,
    createdAt: new Date()
  });
};

// Method to update progress
enrollmentSchema.methods.updateProgress = async function() {
  const Lesson = require('./Lesson');
  const totalLessons = await Lesson.countDocuments({
    courseId: this.courseId,
    isPublished: true
  });
  
  if (totalLessons > 0) {
    this.progress = Math.round((this.completedLessons.length / totalLessons) * 100);
    
    // Mark as completed if all lessons are done
    if (this.progress >= 100 && this.status === 'active') {
      this.status = 'completed';
      
      // Issue certificate if not already issued
      if (!this.certificate.issued) {
        this.certificate.issued = true;
        this.certificate.issuedAt = new Date();
        // In production, generate actual certificate URL
        this.certificate.certificateUrl = `/certificates/${this.userId}/${this.courseId}`;
      }
    }
  }
};

// Static method to get user's enrollments
enrollmentSchema.statics.findByUser = function(userId, status = null) {
  const filter = { userId };
  if (status) {
    filter.status = status;
  }
  return this.find(filter)
    .populate('courseId', 'name description image instructor rating duration')
    .sort({ lastAccessedAt: -1 });
};

// Static method to get course enrollments
enrollmentSchema.statics.findByCourse = function(courseId, status = null) {
  const filter = { courseId };
  if (status) {
    filter.status = status;
  }
  return this.find(filter)
    .populate('userId', 'name email avatar')
    .sort({ createdAt: -1 });
};

// Static method to check if user is enrolled
enrollmentSchema.statics.isUserEnrolled = function(userId, courseId) {
  return this.findOne({
    userId,
    courseId,
    status: { $in: ['active', 'completed'] }
  });
};

module.exports = mongoose.model('Enrollment', enrollmentSchema);