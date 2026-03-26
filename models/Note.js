const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
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
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Tiêu đề ghi chú không được quá 200 ký tự'],
    default: ''
  },
  content: {
    type: String,
    required: [true, 'Nội dung ghi chú là bắt buộc'],
    trim: true,
    maxlength: [5000, 'Nội dung ghi chú không được quá 5000 ký tự']
  },
  timestamp: {
    type: Number, // vị trí thời gian trong video (giây) nếu ghi chú liên quan đến video
    default: null,
    min: [0, 'Timestamp không thể âm']
  },
  color: {
    type: String,
    enum: ['yellow', 'blue', 'green', 'red', 'purple', 'orange', 'pink', 'gray'],
    default: 'yellow'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag không được quá 50 ký tự']
  }],
  isPrivate: {
    type: Boolean,
    default: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  // Metadata bổ sung
  metadata: {
    wordCount: {
      type: Number,
      default: 0
    },
    lastEditedAt: {
      type: Date,
      default: Date.now
    },
    editCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index để tối ưu hóa truy vấn
noteSchema.index({ userId: 1, courseId: 1, lessonId: 1 });
noteSchema.index({ userId: 1, courseId: 1 });
noteSchema.index({ userId: 1, isPinned: -1, createdAt: -1 });
noteSchema.index({ userId: 1, tags: 1 });
noteSchema.index({ content: 'text', title: 'text' }); // Text search

// Virtual để format timestamp
noteSchema.virtual('formattedTimestamp').get(function() {
  if (!this.timestamp) return null;
  
  const minutes = Math.floor(this.timestamp / 60);
  const seconds = Math.floor(this.timestamp % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual để lấy preview nội dung
noteSchema.virtual('preview').get(function() {
  if (!this.content) return '';
  return this.content.length > 100 ? 
    this.content.substring(0, 100) + '...' : 
    this.content;
});

// Middleware để cập nhật metadata
noteSchema.pre('save', function(next) {
  // Cập nhật word count
  this.metadata.wordCount = this.content ? this.content.split(/\s+/).filter(word => word.length > 0).length : 0;
  
  // Cập nhật lastEditedAt nếu nội dung thay đổi
  if (this.isModified('content') || this.isModified('title')) {
    this.metadata.lastEditedAt = new Date();
    if (!this.isNew) {
      this.metadata.editCount += 1;
    }
  }
  
  // Tự động tạo title nếu chưa có
  if (!this.title && this.content) {
    this.title = this.content.substring(0, 50) + (this.content.length > 50 ? '...' : '');
  }
  
  next();
});

// Static method để lấy ghi chú theo bài học
noteSchema.statics.getNotesByLesson = function(userId, lessonId, includeArchived = false) {
  const filter = { userId, lessonId };
  if (!includeArchived) {
    filter.isArchived = false;
  }
  
  return this.find(filter)
    .sort({ isPinned: -1, createdAt: -1 })
    .populate('lessonId', 'title order')
    .populate('courseId', 'name');
};

// Static method để lấy ghi chú theo khóa học
noteSchema.statics.getNotesByCourse = function(userId, courseId, includeArchived = false) {
  const filter = { userId, courseId };
  if (!includeArchived) {
    filter.isArchived = false;
  }
  
  return this.find(filter)
    .sort({ isPinned: -1, createdAt: -1 })
    .populate('lessonId', 'title order')
    .populate('courseId', 'name');
};

// Static method để tìm kiếm ghi chú
noteSchema.statics.searchNotes = function(userId, query, filters = {}) {
  const searchFilter = {
    userId,
    isArchived: false,
    $text: { $search: query },
    ...filters
  };
  
  return this.find(searchFilter, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, isPinned: -1 })
    .populate('lessonId', 'title order')
    .populate('courseId', 'name');
};

// Static method để lấy ghi chú theo tags
noteSchema.statics.getNotesByTags = function(userId, tags, includeArchived = false) {
  const filter = { 
    userId, 
    tags: { $in: tags }
  };
  
  if (!includeArchived) {
    filter.isArchived = false;
  }
  
  return this.find(filter)
    .sort({ isPinned: -1, createdAt: -1 })
    .populate('lessonId', 'title order')
    .populate('courseId', 'name');
};

// Static method để lấy thống kê ghi chú
noteSchema.statics.getNotesStats = async function(userId, courseId = null) {
  const matchFilter = { userId };
  if (courseId) {
    matchFilter.courseId = new mongoose.Types.ObjectId(courseId);
  }
  
  const stats = await this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalNotes: { $sum: 1 },
        pinnedNotes: { 
          $sum: { $cond: [{ $eq: ['$isPinned', true] }, 1, 0] } 
        },
        archivedNotes: { 
          $sum: { $cond: [{ $eq: ['$isArchived', true] }, 1, 0] } 
        },
        totalWords: { $sum: '$metadata.wordCount' },
        averageWordsPerNote: { $avg: '$metadata.wordCount' },
        totalEdits: { $sum: '$metadata.editCount' },
        lastNoteCreated: { $max: '$createdAt' },
        lastNoteEdited: { $max: '$metadata.lastEditedAt' }
      }
    }
  ]);
  
  return stats[0] || {
    totalNotes: 0,
    pinnedNotes: 0,
    archivedNotes: 0,
    totalWords: 0,
    averageWordsPerNote: 0,
    totalEdits: 0,
    lastNoteCreated: null,
    lastNoteEdited: null
  };
};

// Static method để lấy tags phổ biến
noteSchema.statics.getPopularTags = async function(userId, limit = 10) {
  const tags = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isArchived: false } },
    { $unwind: '$tags' },
    { 
      $group: { 
        _id: '$tags', 
        count: { $sum: 1 },
        lastUsed: { $max: '$createdAt' }
      } 
    },
    { $sort: { count: -1, lastUsed: -1 } },
    { $limit: limit }
  ]);
  
  return tags.map(tag => ({
    name: tag._id,
    count: tag.count,
    lastUsed: tag.lastUsed
  }));
};

module.exports = mongoose.model('Note', noteSchema);