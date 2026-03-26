const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Nội dung bình luận là bắt buộc'],
    trim: true,
    maxlength: [1000, 'Bình luận không được quá 1000 ký tự'],
    minlength: [1, 'Bình luận phải có ít nhất 1 ký tự']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Người dùng là bắt buộc']
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Khóa học là bắt buộc']
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null // null cho bình luận gốc, có giá trị cho reply
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isReported: {
    type: Boolean,
    default: false
  },
  reportedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
commentSchema.index({ course: 1, createdAt: -1 });
commentSchema.index({ user: 1 });
commentSchema.index({ parentComment: 1 });

// Virtual for likes count
commentSchema.virtual('likesCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for replies count
commentSchema.virtual('repliesCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  count: true,
  match: { isActive: true }
});

// Virtual for formatted time
commentSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days} ngày trước`;
  if (hours > 0) return `${hours} giờ trước`;
  if (minutes > 0) return `${minutes} phút trước`;
  return 'Vừa xong';
});

// Method to check if user liked this comment
commentSchema.methods.isLikedByUser = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Method to add like
commentSchema.methods.addLike = function(userId) {
  if (!this.isLikedByUser(userId)) {
    this.likes.push({ user: userId });
  }
  return this.save();
};

// Method to remove like
commentSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(like => like.user.toString() !== userId.toString());
  return this.save();
};

// Static method to get comments for a course
commentSchema.statics.getCommentsForCourse = function(courseId, options = {}) {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ 
    course: courseId, 
    parentComment: null, // Only root comments
    isActive: true 
  })
    .populate('user', 'name email')
    .populate('likes.user', 'name')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get replies for a comment
commentSchema.statics.getRepliesForComment = function(commentId, options = {}) {
  const { page = 1, limit = 5 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ 
    parentComment: commentId,
    isActive: true 
  })
    .populate('user', 'name email')
    .populate('likes.user', 'name')
    .sort({ createdAt: 1 }) // Replies sorted oldest first
    .skip(skip)
    .limit(limit);
};

// Pre-save middleware
commentSchema.pre('save', function(next) {
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Comment', commentSchema);