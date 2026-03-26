const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: [true, 'Cuộc trò chuyện là bắt buộc']
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Người gửi là bắt buộc']
  },
  content: {
    type: String,
    required: [true, 'Nội dung tin nhắn là bắt buộc'],
    trim: true,
    maxlength: [2000, 'Tin nhắn không được quá 2000 ký tự']
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    fileName: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      enum: ['👍', '❤️', '😊', '😂', '😮', '😢', '😡']
    },
    reactedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  metadata: {
    deliveredAt: {
      type: Date,
      default: Date.now
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, isDeleted: 1, createdAt: -1 });

// Virtual for formatted time
messageSchema.virtual('timeAgo').get(function() {
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

// Virtual for read status
messageSchema.virtual('isRead').get(function() {
  return this.readBy && this.readBy.length > 1; // More than just sender
});

// Virtual for reaction count
messageSchema.virtual('reactionCount').get(function() {
  return this.reactions ? this.reactions.length : 0;
});

// Method to check if user has read this message
messageSchema.methods.isReadByUser = function(userId) {
  return this.readBy.some(read => read.user.toString() === userId.toString());
};

// Method to mark as read by user
messageSchema.methods.markAsReadBy = function(userId) {
  if (!this.isReadByUser(userId)) {
    this.readBy.push({ user: userId });
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from user
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  
  // Add new reaction
  this.reactions.push({ user: userId, emoji });
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  return this.save();
};

// Method to edit message
messageSchema.methods.editMessage = function(newContent) {
  // Save edit history
  if (this.content !== newContent) {
    this.editHistory.push({ content: this.content });
    this.content = newContent;
    this.isEdited = true;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to soft delete message
messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static method to get messages for conversation
messageSchema.statics.getConversationMessages = function(conversationId, options = {}) {
  const { page = 1, limit = 50, before = null, after = null } = options;
  const skip = (page - 1) * limit;
  
  let query = {
    conversation: conversationId,
    isDeleted: false
  };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }
  
  if (after) {
    query.createdAt = { $gt: new Date(after) };
  }

  return this.find(query)
    .populate('sender', 'name email role')
    .populate('replyTo', 'content sender')
    .populate('readBy.user', 'name')
    .populate('reactions.user', 'name')
    .sort({ createdAt: before ? -1 : 1 })
    .skip(skip)
    .limit(limit);
};

// Static method to search messages in conversation
messageSchema.statics.searchMessages = function(conversationId, searchTerm, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  return this.find({
    conversation: conversationId,
    content: { $regex: searchTerm, $options: 'i' },
    isDeleted: false
  })
    .populate('sender', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get unread message count for user in conversation
messageSchema.statics.getUnreadCount = async function(conversationId, userId) {
  return this.countDocuments({
    conversation: conversationId,
    sender: { $ne: userId },
    'readBy.user': { $ne: userId },
    isDeleted: false
  });
};

// Pre-save middleware to update conversation's lastMessage
messageSchema.pre('save', async function(next) {
  if (this.isNew && !this.isDeleted) {
    try {
      const Conversation = mongoose.model('Conversation');
      await Conversation.findByIdAndUpdate(this.conversation, {
        lastMessage: this._id,
        lastActivity: new Date(),
        $inc: { 'metadata.totalMessages': 1 }
      });
      
      // Increment unread count for other participants
      const conversation = await Conversation.findById(this.conversation);
      if (conversation) {
        await conversation.incrementUnreadCount(this.sender);
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  }
  next();
});

// Pre-remove middleware to update conversation
messageSchema.pre('remove', async function(next) {
  try {
    const Conversation = mongoose.model('Conversation');
    
    // If this was the last message, find the previous one
    const conversation = await Conversation.findById(this.conversation);
    if (conversation && conversation.lastMessage && conversation.lastMessage.toString() === this._id.toString()) {
      const previousMessage = await this.constructor.findOne({
        conversation: this.conversation,
        _id: { $ne: this._id },
        isDeleted: false
      }).sort({ createdAt: -1 });
      
      await Conversation.findByIdAndUpdate(this.conversation, {
        lastMessage: previousMessage ? previousMessage._id : null,
        $inc: { 'metadata.totalMessages': -1 }
      });
    }
  } catch (error) {
    console.error('Error updating conversation on message delete:', error);
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);