const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const passport = require('passport');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, role = 'user', phone, age } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json(
        ApiResponse.error('User already exists', 400)
      );
    }

    // Validate role
    if (!['user', 'admin', 'teacher'].includes(role)) {
      return res.status(400).json(
        ApiResponse.error('Invalid role specified', 400)
      );
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      age,
      lastLogin: new Date()
    });

    if (user) {
      const token = generateToken(user._id);
      
      res.status(201).json(
        ApiResponse.success('User registered successfully', {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive
          },
          token
        })
      );
    } else {
      res.status(400).json(
        ApiResponse.error('Invalid user data', 400)
      );
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json(
      ApiResponse.error('Server error during registration', 500)
    );
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json(
        ApiResponse.error('Invalid credentials', 401)
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json(
        ApiResponse.error('Account has been deactivated', 401)
      );
    }

    // If the user has no local password (e.g. Google-only account), reject with clear message
    if (!user.password) {
      return res.status(401).json(
        ApiResponse.error('This account does not have a password set. Please login with Google or set a password.', 401)
      );
    }

    // Check password (comparePassword is resilient to missing fields)
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json(
        ApiResponse.error('Invalid credentials', 401)
      );
    }

    // Update last login without triggering full validation (prevents unrelated schema validation failures)
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json(
      ApiResponse.success('Login successful', {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin
        },
        token
      })
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(
      ApiResponse.error('Server error during login', 500)
    );
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.json(
      ApiResponse.success('User profile retrieved', user)
    );
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json(
      ApiResponse.error('Server error', 500)
    );
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      age: req.body.age,
      address: req.body.address,
      bio: req.body.bio
    };

    // Handle skills - parse if it's a string
    if (req.body.skills) {
      try {
        fieldsToUpdate.skills = typeof req.body.skills === 'string' 
          ? JSON.parse(req.body.skills) 
          : req.body.skills;
      } catch (error) {
        console.error('Error parsing skills:', error);
        fieldsToUpdate.skills = req.body.skills;
      }
    }

    // Handle socialLinks - parse if it's a string
    if (req.body.socialLinks) {
      try {
        fieldsToUpdate.socialLinks = typeof req.body.socialLinks === 'string' 
          ? JSON.parse(req.body.socialLinks) 
          : req.body.socialLinks;
      } catch (error) {
        console.error('Error parsing socialLinks:', error);
        fieldsToUpdate.socialLinks = req.body.socialLinks;
      }
    }

    // Handle avatar upload - URL đã được xử lý bởi processFileUrls middleware
    if (req.body.avatar) {
      fieldsToUpdate.avatar = req.body.avatar;
    }

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key => 
      fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    // Check if email is being updated and if it already exists
    if (fieldsToUpdate.email) {
      const existingUser = await User.findOne({ 
        email: fieldsToUpdate.email,
        _id: { $ne: req.user.id }
      });
      
      if (existingUser) {
        return res.status(400).json(
          ApiResponse.error('Email already exists', 400)
        );
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.json(
      ApiResponse.success('Profile updated successfully', { user })
    );
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json(
      ApiResponse.error('Server error', 500)
    );
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json(
        ApiResponse.error('Current password is incorrect', 400)
      );
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json(
      ApiResponse.success('Password changed successfully')
    );
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json(
      ApiResponse.error('Server error', 500)
    );
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    res.json(
      ApiResponse.success('Logged out successfully')
    );
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json(
      ApiResponse.error('Server error', 500)
    );
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const role = req.query.role;
    const isActive = req.query.isActive;

    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json(
      ApiResponse.success('Users retrieved successfully', {
        users,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      })
    );
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json(
      ApiResponse.error('Server error', 500)
    );
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/auth/users/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!['user', 'admin', 'teacher'].includes(role)) {
      return res.status(400).json(
        ApiResponse.error('Invalid role specified', 400)
      );
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    res.json(
      ApiResponse.success('User role updated successfully', user)
    );
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json(
      ApiResponse.error('Server error', 500)
    );
  }
};

// @desc    Toggle user active status (Admin only)
// @route   PUT /api/auth/users/:id/toggle-status
// @access  Private/Admin
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json(
      ApiResponse.success('User status updated successfully', {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        }
      })
    );
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json(
      ApiResponse.error('Server error', 500)
    );
  }
};

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(
        ApiResponse.error('Email is required', 400)
      );
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json(
        ApiResponse.error('Không tìm thấy tài khoản với email này', 404)
      );
    }

    if (!user.isActive) {
      return res.status(401).json(
        ApiResponse.error('Tài khoản đã bị vô hiệu hóa', 401)
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expire time (10 minutes)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

    // For development, we'll return the reset URL in response
    // In production, you would send this via email
    const message = `Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng truy cập link sau để đặt lại mật khẩu (có hiệu lực trong 10 phút): ${resetUrl}`;

    res.json(
      ApiResponse.success('Email đặt lại mật khẩu đã được gửi', {
        message,
        resetUrl, // Only for development
        expiresIn: '10 minutes'
      })
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    
    // Clear reset token fields if error occurs
    if (req.body.email) {
      const user = await User.findOne({ email: req.body.email });
      if (user) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
      }
    }

    res.status(500).json(
      ApiResponse.error('Không thể gửi email đặt lại mật khẩu', 500)
    );
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const { token } = req.params;

    if (!password || !confirmPassword) {
      return res.status(400).json(
        ApiResponse.error('Vui lòng điền đầy đủ thông tin', 400)
      );
    }

    if (password !== confirmPassword) {
      return res.status(400).json(
        ApiResponse.error('Mật khẩu xác nhận không khớp', 400)
      );
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json(
        ApiResponse.error('Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ hoa, chữ thường và số', 400)
      );
    }

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json(
        ApiResponse.error('Token không hợp lệ hoặc đã hết hạn', 400)
      );
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new JWT token
    const jwtToken = generateToken(user._id);

    res.json(
      ApiResponse.success('Mật khẩu đã được đặt lại thành công', {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        },
        token: jwtToken
      })
    );
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json(
      ApiResponse.error('Không thể đặt lại mật khẩu', 500)
    );
  }
};

// @desc    Setup security questions
// @route   PUT /api/auth/security-questions
// @access  Private
const setupSecurityQuestions = async (req, res) => {
  try {
    console.log('🚀 setupSecurityQuestions called');
    console.log('📝 Request body:', req.body);
    console.log('👤 User from middleware:', req.user ? req.user.email : 'NO USER');
    console.log('👤 User ID from token:', req.user ? req.user.id : 'NO ID');
    
    const { question1, answer1, question2, answer2 } = req.body;

    if (!question1 || !answer1 || !question2 || !answer2) {
      console.log('❌ Missing required fields');
      return res.status(400).json(
        ApiResponse.error('Vui lòng điền đầy đủ thông tin câu hỏi bảo mật', 400)
      );
    }

    if (question1 === question2) {
      return res.status(400).json(
        ApiResponse.error('Hai câu hỏi bảo mật phải khác nhau', 400)
      );
    }

    if (answer1.trim().toLowerCase() === answer2.trim().toLowerCase()) {
      return res.status(400).json(
        ApiResponse.error('Hai câu trả lời phải khác nhau', 400)
      );
    }

    const user = await User.findById(req.user.id);
    
    // Set security questions - answers will be hashed by pre-save middleware
    user.securityQuestions = {
      question1: {
        question: question1,
        answer: answer1
      },
      question2: {
        question: question2,
        answer: answer2
      }
    };

    // Mark securityQuestions as modified to trigger pre-save middleware
    user.markModified('securityQuestions');
    
    console.log('💾 Saving user with security questions...');
    await user.save();
    console.log('✅ User saved successfully');

    res.json(
      ApiResponse.success('Cài đặt câu hỏi bảo mật thành công', {
        hasSecurityQuestions: user.hasSecurityQuestions()
      })
    );
  } catch (error) {
    console.error('Setup security questions error:', error);
    res.status(500).json(
      ApiResponse.error('Lỗi server khi cài đặt câu hỏi bảo mật', 500)
    );
  }
};

// @desc    Get security questions for password recovery
// @route   POST /api/auth/security-questions/verify-user
// @access  Public
const getSecurityQuestions = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('🔍 getSecurityQuestions called with email:', email);

    if (!email) {
      console.log('❌ No email provided');
      return res.status(400).json(
        ApiResponse.error('Email là bắt buộc', 400)
      );
    }

    const user = await User.findOne({ email }).select('+securityQuestions.question1.answer +securityQuestions.question2.answer');
    console.log('👤 User found:', user ? user.email : 'null');

    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json(
        ApiResponse.error('Không tìm thấy tài khoản với email này', 404)
      );
    }

    if (!user.isActive) {
      console.log('❌ User not active');
      return res.status(401).json(
        ApiResponse.error('Tài khoản đã bị vô hiệu hóa', 401)
      );
    }

    const hasQuestions = user.hasSecurityQuestions();
    console.log('🔐 User has security questions:', hasQuestions);
    console.log('🔐 Security questions data:', user.securityQuestions);

    if (!hasQuestions) {
      console.log('❌ User does not have security questions');
      return res.status(400).json(
        ApiResponse.error('Tài khoản chưa cài đặt câu hỏi bảo mật. Vui lòng sử dụng phương thức đặt lại qua email.', 400)
      );
    }

    res.json(
      ApiResponse.success('Lấy câu hỏi bảo mật thành công', {
        userId: user._id,
        questions: [
          user.securityQuestions.question1.question,
          user.securityQuestions.question2.question
        ]
      })
    );
  } catch (error) {
    console.error('Get security questions error:', error);
    res.status(500).json(
      ApiResponse.error('Lỗi server khi lấy câu hỏi bảo mật', 500)
    );
  }
};

// @desc    Verify security answers and reset password
// @route   PUT /api/auth/reset-password-security
// @access  Public
const resetPasswordWithSecurity = async (req, res) => {
  try {
    const { userId, answer1, answer2, newPassword, confirmPassword } = req.body;

    if (!userId || !answer1 || !answer2 || !newPassword || !confirmPassword) {
      return res.status(400).json(
        ApiResponse.error('Vui lòng điền đầy đủ thông tin', 400)
      );
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json(
        ApiResponse.error('Mật khẩu xác nhận không khớp', 400)
      );
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json(
        ApiResponse.error('Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ hoa, chữ thường và số', 400)
      );
    }

    const user = await User.findById(userId).select('+securityQuestions.question1.answer +securityQuestions.question2.answer');

    if (!user) {
      return res.status(404).json(
        ApiResponse.error('Không tìm thấy tài khoản', 404)
      );
    }

    if (!user.hasSecurityQuestions()) {
      return res.status(400).json(
        ApiResponse.error('Tài khoản chưa cài đặt câu hỏi bảo mật', 400)
      );
    }

    // Verify both security answers
    const isAnswer1Correct = await user.compareSecurityAnswer(1, answer1);
    const isAnswer2Correct = await user.compareSecurityAnswer(2, answer2);

    if (!isAnswer1Correct || !isAnswer2Correct) {
      return res.status(400).json(
        ApiResponse.error('Câu trả lời không chính xác', 400)
      );
    }

    // Set new password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new JWT token
    const token = generateToken(user._id);

    res.json(
      ApiResponse.success('Đặt lại mật khẩu thành công', {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        },
        token
      })
    );
  } catch (error) {
    console.error('Reset password with security error:', error);
    res.status(500).json(
      ApiResponse.error('Lỗi server khi đặt lại mật khẩu', 500)
    );
  }
};

// @desc    Get available security questions list
// @route   GET /api/auth/security-questions/list
// @access  Public
const getSecurityQuestionsList = async (req, res) => {
  try {
    const questions = [
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
    ];

    res.json(
      ApiResponse.success('Lấy danh sách câu hỏi bảo mật thành công', {
        questions
      })
    );
  } catch (error) {
    console.error('Get security questions list error:', error);
    res.status(500).json(
      ApiResponse.error('Lỗi server', 500)
    );
  }
};

// @desc    Google OAuth login
// @route   GET /api/auth/google
// @access  Public
const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email']
});

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
const googleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err) {
      console.error('Google OAuth callback error:', err);
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth.html?error=oauth_error`);
    }
    
    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth.html?error=oauth_failed`);
    }

    // Tạo JWT token
    const token = generateToken(user._id);

    // Redirect về frontend với token
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth.html?token=${token}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}`);
  })(req, res, next);
};

// @desc    Link Google account to existing account
// @route   POST /api/auth/link-google
// @access  Private
const linkGoogleAccount = async (req, res) => {
  try {
    const { googleId, googleEmail } = req.body;
    
    if (!googleId || !googleEmail) {
      return res.status(400).json(
        ApiResponse.error('Google ID và email là bắt buộc', 400)
      );
    }

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json(
        ApiResponse.error('Không tìm thấy người dùng', 404)
      );
    }

    // Kiểm tra xem Google account đã được liên kết với tài khoản khác chưa
    const existingGoogleUser = await User.findOne({ googleId });
    
    if (existingGoogleUser && existingGoogleUser._id.toString() !== user._id.toString()) {
      return res.status(400).json(
        ApiResponse.error('Tài khoản Google này đã được liên kết với tài khoản khác', 400)
      );
    }

    // Liên kết tài khoản Google
    user.googleId = googleId;
    if (!user.provider || user.provider === 'local') {
      user.provider = 'google';
    }
    
    await user.save();

    res.json(
      ApiResponse.success('Liên kết tài khoản Google thành công', {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          provider: user.provider,
          googleId: user.googleId ? 'linked' : null
        }
      })
    );
  } catch (error) {
    console.error('Link Google account error:', error);
    res.status(500).json(
      ApiResponse.error('Lỗi server khi liên kết tài khoản Google', 500)
    );
  }
};

// @desc    Unlink Google account
// @route   DELETE /api/auth/unlink-google
// @access  Private
const unlinkGoogleAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json(
        ApiResponse.error('Không tìm thấy người dùng', 404)
      );
    }

    if (!user.googleId) {
      return res.status(400).json(
        ApiResponse.error('Tài khoản chưa được liên kết với Google', 400)
      );
    }

    // Kiểm tra xem user có password không (để đảm bảo vẫn đăng nhập được)
    if (!user.password) {
      return res.status(400).json(
        ApiResponse.error('Không thể hủy liên kết Google khi chưa đặt mật khẩu. Vui lòng đặt mật khẩu trước khi hủy liên kết.', 400)
      );
    }

    // Hủy liên kết
    user.googleId = undefined;
    user.provider = 'local';
    
    await user.save();

    res.json(
      ApiResponse.success('Hủy liên kết tài khoản Google thành công', {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          provider: user.provider,
          googleId: null
        }
      })
    );
  } catch (error) {
    console.error('Unlink Google account error:', error);
    res.status(500).json(
      ApiResponse.error('Lỗi server khi hủy liên kết tài khoản Google', 500)
    );
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  forgotPassword,
  resetPassword,
  setupSecurityQuestions,
  getSecurityQuestions,
  resetPasswordWithSecurity,
  getSecurityQuestionsList,
  googleAuth,
  googleCallback,
  linkGoogleAccount,
  unlinkGoogleAccount
};