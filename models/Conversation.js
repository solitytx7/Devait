const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['student', 'teacher'],
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  }],
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Tiêu đề cuộc trò chuyện không được quá 200 ký tự']
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPinned: {
    student: {
      type: Boolean,
      default: false
    },
    teacher: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    totalMessages: {
      type: Number,
      default: 0
    },
    unreadCount: {
      student: {
        type: Number,
        default: 0
      },
      teacher: {
        type: Number,
        default: 0
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
conversationSchema.index({ 'participants.user': 1, course: 1 });
conversationSchema.index({ lastActivity: -1 });
conversationSchema.index({ course: 1, isActive: 1 });

// Virtual for getting student participant
conversationSchema.virtual('student').get(function() {
  return this.participants.find(p => p.role === 'student');
});

// Virtual for getting teacher participant
conversationSchema.virtual('teacher').get(function() {
  return this.participants.find(p => p.role === 'teacher');
});

// Virtual for getting conversation partner for a specific user
conversationSchema.virtual('partner').get(function() {
  // This will be set dynamically based on the requesting user
  return null;
});

// Method to check if user is participant
conversationSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.user.toString() === userId.toString());
};

// Method to get user's role in conversation
conversationSchema.methods.getUserRole = function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  return participant ? participant.role : null;
};

// Method to update last seen for user
conversationSchema.methods.updateLastSeen = function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    participant.lastSeen = new Date();
  }
  return this.save();
};

// Method to mark messages as read
conversationSchema.methods.markAsRead = function(userId) {
  const userRole = this.getUserRole(userId);
  if (userRole) {
    this.metadata.unreadCount[userRole] = 0;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to increment unread count
conversationSchema.methods.incrementUnreadCount = function(excludeUserId) {
  this.participants.forEach(participant => {
    if (participant.user.toString() !== excludeUserId.toString()) {
      this.metadata.unreadCount[participant.role]++;
    }
  });
  return this.save();
};

// Static method to find or create conversation between student and teacher for a course
conversationSchema.statics.findOrCreateConversation = async function(studentId, teacherId, courseId) {
  try {
    // Try to find existing conversation
    let conversation = await this.findOne({
      course: courseId,
      'participants.user': { $all: [studentId, teacherId] },
      isActive: true
    }).populate('participants.user', 'name email role')
      .populate('course', 'name instructor')
      .populate('lastMessage');

    if (!conversation) {
      // Create new conversation
      conversation = new this({
        participants: [
          { user: studentId, role: 'student' },
          { user: teacherId, role: 'teacher' }
        ],
        course: courseId,
        title: `Trao đổi về khóa học`
      });

      await conversation.save();
      
      // Populate the newly created conversation
      conversation = await this.findById(conversation._id)
        .populate('participants.user', 'name email role')
        .populate('course', 'name instructor')
        .populate('lastMessage');
    }

    return conversation;
  } catch (error) {
    throw error;
  }
};

// Static method to get conversations for a user
conversationSchema.statics.getUserConversations = function(userId, options = {}) {
  const { page = 1, limit = 20, search = '', courseId = null } = options;
  const skip = (page - 1) * limit;
  
  // Convert userId to ObjectId if it's a string
  const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  
  let query = {
    'participants.user': userObjectId,
    isActive: true
  };

  if (courseId) {
    query.course = courseId;
  }

  let aggregationPipeline = [
    { $match: query },
    {
      $lookup: {
        from: 'users',
        localField: 'participants.user',
        foreignField: '_id',
        as: 'participantUsers'
      }
    },
    {
      $lookup: {
        from: 'courses',
        localField: 'course',
        foreignField: '_id',
        as: 'courseInfo'
      }
    },
    {
      $lookup: {
        from: 'messages',
        localField: 'lastMessage',
        foreignField: '_id',
        as: 'lastMessageInfo'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'lastMessageInfo.sender',
        foreignField: '_id',
        as: 'lastMessageSender'
      }
    },
    {
      $addFields: {
        'lastMessageInfo': {
          $cond: {
            if: { $gt: [{ $size: '$lastMessageInfo' }, 0] },
            then: {
              $mergeObjects: [
                { $arrayElemAt: ['$lastMessageInfo', 0] },
                { sender: { $arrayElemAt: ['$lastMessageSender', 0] } }
              ]
            },
            else: null
          }
        }
      }
    }
  ];

  if (search) {
    aggregationPipeline.push({
      $match: {
        $or: [
          { 'participantUsers.name': { $regex: search, $options: 'i' } },
          { 'courseInfo.name': { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } }
        ]
      }
    });
  }

  aggregationPipeline.push(
    { $sort: { lastActivity: -1 } },
    { $skip: skip },
    { $limit: limit }
  );

  return this.aggregate(aggregationPipeline);
};

// Pre-save middleware to update lastActivity
conversationSchema.pre('save', function(next) {
  if (this.isModified('lastMessage')) {
    this.lastActivity = new Date();
  }
  next();
});

module.exports = mongoose.model('Conversation', conversationSchema);