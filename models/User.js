const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password không bắt buộc nếu đăng nhập bằng Google
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true // Cho phép null và chỉ áp dụng unique cho các giá trị không null
  },
  provider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  avatar: {
    type: String,
    default: null // URL to avatar image
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  skills: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
      default: 'Beginner'
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      max: 50,
      default: 0
    }
  }],
  socialLinks: {
    website: String,
    linkedin: String,
    github: String,
    twitter: String,
    facebook: String
  },
  age: {
    type: Number,
    min: [0, 'Age cannot be negative'],
    max: [120, 'Age cannot be more than 120']
  },
  phone: {
    type: String,
    match: [/^\d{10,15}$/, 'Please enter a valid phone number']
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'teacher'],
    default: 'user'
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  // Security Questions for password recovery
  securityQuestions: {
    question1: {
      question: {
        type: String,
        enum: [
          'Tên thú cưng đầu tiên của bạn là gì?',
          'Tên trường tiểu học bạn đã học là gì?',
          'Tên của người bạn thân nhất thời thơ ấu?',
          'Màu sắc yêu thích của bạn là gì?',
          'Tên của giáo viên yêu thích nhất?',
          'Thành phố sinh ra của bạn?',
          'Tên của bộ phim yêu thích?',
          'Tên của cuốn sách yêu thích?',
          'Biệt danh thời thơ ấu của bạn?',
          'Tên của nhà hàng yêu thích?'
        ]
      },
      answer: {
        type: String,
        select: false // Không hiển thị trong queries
      }
    },
    question2: {
      question: {
        type: String,
        enum: [
          'Tên thú cưng đầu tiên của bạn là gì?',
          'Tên trường tiểu học bạn đã học là gì?',
          'Tên của người bạn thân nhất thời thơ ấu?',
          'Màu sắc yêu thích của bạn là gì?',
          'Tên của giáo viên yêu thích nhất?',
          'Thành phố sinh ra của bạn?',
          'Tên của bộ phim yêu thích?',
          'Tên của cuốn sách yêu thích?',
          'Biệt danh thời thơ ấu của bạn?',
          'Tên của nhà hàng yêu thích?'
        ]
      },
      answer: {
        type: String,
        select: false
      }
    }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Automatically add createdAt and updatedAt
});

// Hash password and security answers before saving
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Hash security question answers if modified
  if (this.isModified('securityQuestions') && this.securityQuestions) {
    console.log('🔒 Hashing security question answers...');
    console.log('🔍 Before hashing:', JSON.stringify(this.securityQuestions, null, 2));
    
    if (this.securityQuestions.question1 && this.securityQuestions.question1.answer) {
      const salt1 = await bcrypt.genSalt(12);
      const originalAnswer1 = this.securityQuestions.question1.answer;
      this.securityQuestions.question1.answer = await bcrypt.hash(
        originalAnswer1.toLowerCase().trim(), 
        salt1
      );
      console.log('✅ Hashed answer 1');
    }
    
    if (this.securityQuestions.question2 && this.securityQuestions.question2.answer) {
      const salt2 = await bcrypt.genSalt(12);
      const originalAnswer2 = this.securityQuestions.question2.answer;
      this.securityQuestions.question2.answer = await bcrypt.hash(
        originalAnswer2.toLowerCase().trim(), 
        salt2
      );
      console.log('✅ Hashed answer 2');
    }
    
    console.log('🔍 After hashing:', JSON.stringify(this.securityQuestions, null, 2));
  } else {
    console.log('⚠️ Security questions not modified or empty');
  }
  
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  try {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (err) {
    console.error('comparePassword error:', err);
    return false;
  }
};

// Compare security question answers
userSchema.methods.compareSecurityAnswer = async function(questionNumber, enteredAnswer) {
  if (questionNumber === 1 && this.securityQuestions.question1.answer) {
    return await bcrypt.compare(
      enteredAnswer.toLowerCase().trim(), 
      this.securityQuestions.question1.answer
    );
  } else if (questionNumber === 2 && this.securityQuestions.question2.answer) {
    return await bcrypt.compare(
      enteredAnswer.toLowerCase().trim(), 
      this.securityQuestions.question2.answer
    );
  }
  return false;
};

// Check if user has security questions set up
userSchema.methods.hasSecurityQuestions = function() {
  return this.securityQuestions && 
         this.securityQuestions.question1 && 
         this.securityQuestions.question1.question && 
         this.securityQuestions.question1.answer &&
         this.securityQuestions.question2 && 
         this.securityQuestions.question2.question && 
         this.securityQuestions.question2.answer;
};

// Generate and hash password token
userSchema.methods.getResetPasswordToken = function() {
  const crypto = require('crypto');
  
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire time (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

// Transform output (remove password from JSON output)
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);