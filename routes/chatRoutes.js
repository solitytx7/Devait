const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  addReaction,
  searchMessages
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

// Validation rules for messages
const messageValidationRules = () => {
  return [
    body('content')
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Nội dung tin nhắn phải từ 1 đến 2000 ký tự'),
    body('messageType')
      .optional()
      .isIn(['text', 'image', 'file', 'system'])
      .withMessage('Loại tin nhắn không hợp lệ'),
    body('replyTo')
      .optional()
      .isMongoId()
      .withMessage('ID tin nhắn trả lời không hợp lệ')
  ];
};

// Validation rules for editing messages
const editMessageValidationRules = () => {
  return [
    body('content')
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Nội dung tin nhắn phải từ 1 đến 2000 ký tự')
  ];
};

// Validation rules for reactions
const reactionValidationRules = () => {
  return [
    body('emoji')
      .isIn(['👍', '❤️', '😊', '😂', '😮', '😢', '😡'])
      .withMessage('Emoji không hợp lệ')
  ];
};

// Routes

// GET /api/chat/conversations - Get user's conversations
router.get('/conversations', protect, getConversations);

// GET /api/chat/conversations/:courseId/instructor - Get or create conversation with course instructor
router.get('/conversations/:courseId/instructor', protect, getOrCreateConversation);

// GET /api/chat/conversations/:conversationId/messages - Get messages in conversation
router.get('/conversations/:conversationId/messages', protect, getMessages);

// POST /api/chat/conversations/:conversationId/messages - Send message in conversation
router.post(
  '/conversations/:conversationId/messages',
  protect,
  messageValidationRules(),
  sendMessage
);

// PUT /api/chat/messages/:messageId - Edit message
router.put(
  '/messages/:messageId',
  protect,
  editMessageValidationRules(),
  editMessage
);

// DELETE /api/chat/messages/:messageId - Delete message
router.delete('/messages/:messageId', protect, deleteMessage);

// POST /api/chat/conversations/:conversationId/read - Mark messages as read
router.post('/conversations/:conversationId/read', protect, markAsRead);

// POST /api/chat/messages/:messageId/reaction - Add reaction to message
router.post(
  '/messages/:messageId/reaction',
  protect,
  reactionValidationRules(),
  addReaction
);

// DELETE /api/chat/messages/:messageId/reaction - Remove reaction from message
router.delete('/messages/:messageId/reaction', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const Message = require('../models/Message');

    // Find message
    const message = await Message.findById(messageId);
    if (!message || message.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin nhắn'
      });
    }

    // Remove reaction
    await message.removeReaction(userId);

    // Populate for response
    await message.populate('reactions.user', 'name');

    res.json({
      success: true,
      message: 'Xóa reaction thành công',
      data: {
        messageId: message._id,
        reactions: message.reactions
      }
    });

  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa reaction'
    });
  }
});

// GET /api/chat/conversations/:conversationId/search - Search messages in conversation
router.get('/conversations/:conversationId/search', protect, searchMessages);

// GET /api/chat/conversations/:conversationId/unread-count - Get unread message count
router.get('/conversations/:conversationId/unread-count', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const Message = require('../models/Message');
    const Conversation = require('../models/Conversation');

    // Check if user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    if (!conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập cuộc trò chuyện này'
      });
    }

    // Get unread count
    const unreadCount = await Message.getUnreadCount(conversationId, userId);

    res.json({
      success: true,
      message: 'Lấy số tin nhắn chưa đọc thành công',
      data: { unreadCount }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy số tin nhắn chưa đọc'
    });
  }
});

// POST /api/chat/conversations/:conversationId/pin - Pin/Unpin conversation
router.post('/conversations/:conversationId/pin', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const Conversation = require('../models/Conversation');

    // Find conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    if (!conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền pin cuộc trò chuyện này'
      });
    }

    // Toggle pin status
    const userRole = conversation.getUserRole(userId);
    const currentPinStatus = conversation.isPinned[userRole];
    conversation.isPinned[userRole] = !currentPinStatus;
    
    await conversation.save();

    res.json({
      success: true,
      message: currentPinStatus ? 'Bỏ pin cuộc trò chuyện thành công' : 'Pin cuộc trò chuyện thành công',
      data: {
        isPinned: !currentPinStatus
      }
    });

  } catch (error) {
    console.error('Pin conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi pin cuộc trò chuyện'
    });
  }
});

// GET /api/chat/online-users - Get online users (for real-time features)
router.get('/online-users', protect, async (req, res) => {
  try {
    // This will be implemented with Socket.IO to track online users
    // For now, return empty array
    res.json({
      success: true,
      message: 'Lấy danh sách người dùng online thành công',
      data: {
        onlineUsers: []
      }
    });

  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách người dùng online'
    });
  }
});

module.exports = router;