const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên khóa học là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên khóa học không được quá 100 ký tự']
  },
  description: {
    type: String,
    required: [true, 'Mô tả khóa học là bắt buộc'],
    trim: true,
    maxlength: [1000, 'Mô tả không được quá 1000 ký tự']
  },
  image: {
    type: String,
    trim: true
  },
  video: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    default: 0,
    min: [0, 'Giá không thể âm']
  },
  duration: {
    type: Number,
    default: 60,
    min: [1, 'Thời lượng phải ít nhất 1 phút']
  },
  level: {
    type: String,
    required: [true, 'Cấp độ khóa học là bắt buộc'],
    enum: {
      values: ['Beginner', 'Intermediate', 'Advanced'],
      message: 'Cấp độ phải là Beginner, Intermediate hoặc Advanced'
    }
  },
  category: {
    type: String,
    required: [true, 'Danh mục khóa học là bắt buộc'],
    trim: true
  },
  instructor: {
    type: String,
    required: [true, 'Tên giảng viên là bắt buộc'],
    trim: true
  },
  rating: {
    type: Number,
    default: 0,
    min: [0, 'Rating không thể âm'],
    max: [5, 'Rating không thể lớn hơn 5']
  },
  studentsCount: {
    type: Number,
    default: 0,
    min: [0, 'Số học viên không thể âm']
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for search functionality
courseSchema.index({ name: 'text', description: 'text', category: 'text', instructor: 'text' });

// Virtual for formatted price
courseSchema.virtual('formattedPrice').get(function() {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(this.price);
});

// Virtual for formatted duration
courseSchema.virtual('formattedDuration').get(function() {
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

// Virtual for published status (for backward compatibility)
courseSchema.virtual('published').get(function() {
  return this.isPublished;
});

courseSchema.virtual('published').set(function(value) {
  this.isPublished = value;
});

// Pre-save middleware
courseSchema.pre('save', function(next) {
  // Capitalize first letter of name
  if (this.name) {
    this.name = this.name.charAt(0).toUpperCase() + this.name.slice(1);
  }
  next();
});

// Static method to get courses by category
courseSchema.statics.findByCategory = function(category) {
  return this.find({ category: new RegExp(category, 'i'), isPublished: true });
};

// Static method to search courses
courseSchema.statics.searchCourses = function(query) {
  return this.find({
    $text: { $search: query },
    isPublished: true
  }).sort({ score: { $meta: 'textScore' } });
};

module.exports = mongoose.model('Course', courseSchema);