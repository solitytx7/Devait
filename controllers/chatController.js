const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Course = require('../models/Course');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const apiResponse = require('../utils/apiResponse');

// Get user's conversations
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const courseId = req.query.courseId || null;

    console.log('=== GET CONVERSATIONS DEBUG ===');
    console.log('User ID:', userId);
    console.log('User info:', req.user);

    const conversations = await Conversation.getUserConversations(userId, {
      page,
      limit,
      search,
      courseId
    });

    console.log('Conversations from DB:', conversations.length);
    
    // Kiểm tra tất cả conversations trong DB
    const allConversations = await Conversation.find({}).populate('participants.user').populate('course');
    console.log('All conversations in DB:', allConversations.length);
    console.log('All conversations:', JSON.stringify(allConversations.map(c => ({
      _id: c._id,
      participants: c.participants.map(p => ({
        userId: p.user ? p.user._id : 'null',
        userName: p.user ? p.user.name : 'null',
        role: p.role
      })),
      course: c.course ? c.course.name : 'null',
      courseId: c.course ? c.course._id : 'null',
      isActive: c.isActive
    })), null, 2));

    // Get total count for pagination
    let countQuery = {
      'participants.user': userId,
      isActive: true
    };
    
    if (courseId) {
      countQuery.course = courseId;
    }

    const total = await Conversation.countDocuments(countQuery);
    console.log('Total matching conversations:', total);

    // Format conversations for response
    const formattedConversations = conversations.map(conv => {
      const currentUser = req.user.id;
      const partner = conv.participantUsers.find(u => u._id.toString() !== currentUser.toString());
      const userRole = conv.participants.find(p => p.user.toString() === currentUser.toString())?.role;
      
      return {
        _id: conv._id,
        title: conv.title || `Trao đổi với ${partner?.name || 'Unknown'}`,
        course: conv.courseInfo && conv.courseInfo.length > 0 ? conv.courseInfo[0] : null,
        partner: partner ? {
          _id: partner._id,
          name: partner.name,
          email: partner.email,
          role: partner.role
        } : null,
        lastMessage: conv.lastMessageInfo || null,
        lastActivity: conv.lastActivity,
        unreadCount: conv.metadata?.unreadCount?.[userRole] || 0,
        isPinned: conv.isPinned?.[userRole] || false,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      };
    });

    res.json(apiResponse.success('Lấy danh sách cuộc trò chuyện thành công', {
      conversations: formattedConversations,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }));

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi lấy cuộc trò chuyện', 500)
    );
  }
};

// Get or create conversation with instructor
const getOrCreateConversation = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    console.log('=== GET OR CREATE CONVERSATION ===');
    console.log('Course ID:', courseId);
    console.log('User ID:', userId);

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy khóa học', 404)
      );
    }

    console.log('Course found:', course.name);
    console.log('Course instructor:', course.instructor);

    // Find instructor user
    let instructor = await User.findOne({ 
      name: course.instructor,
      role: 'teacher'
    });

    // If no exact match, try fuzzy search
    if (!instructor) {
      instructor = await User.findOne({
        name: { $regex: course.instructor, $options: 'i' },
        role: 'teacher'
      });
    }

    // If still no match, get any available teacher
    if (!instructor) {
      instructor = await User.findOne({ role: 'teacher' });
    }

    if (!instructor) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy giảng viên cho khóa học này. Vui lòng liên hệ admin.', 404)
      );
    }

    console.log('Instructor found:', instructor.name);

    // Don't allow teacher to chat with themselves
    if (userId === instructor._id.toString()) {
      return res.status(400).json(
        apiResponse.error('Không thể tạo cuộc trò chuyện với chính mình', 400)
      );
    }

    // Get or create conversation
    const conversation = await Conversation.findOrCreateConversation(
      userId,
      instructor._id,
      courseId
    );

    console.log('Conversation created/found:', conversation._id);

    // Update last seen for current user
    await conversation.updateLastSeen(userId);

    // Format response
    const partner = conversation.participants.find(
      p => p.user._id.toString() !== userId.toString()
    );

    const response = {
      _id: conversation._id,
      title: conversation.title || `Trao đổi về ${conversation.course.name}`,
      course: {
        _id: conversation.course._id,
        name: conversation.course.name
      },
      partner: {
        _id: partner.user._id,
        name: partner.user.name,
        email: partner.user.email,
        role: partner.user.role
      },
      lastMessage: conversation.lastMessage,
      lastActivity: conversation.lastActivity,
      unreadCount: conversation.metadata.unreadCount[conversation.getUserRole(userId)] || 0,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    };

    res.json(apiResponse.success('Lấy cuộc trò chuyện thành công', response));

  } catch (error) {
    console.error('Get or create conversation error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi tạo cuộc trò chuyện', 500)
    );
  }
};

// Get messages in conversation
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before;
    const after = req.query.after;

    // Check if user is participant in conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy cuộc trò chuyện', 404)
      );
    }

    if (!conversation.isParticipant(userId)) {
      return res.status(403).json(
        apiResponse.error('Bạn không có quyền truy cập cuộc trò chuyện này', 403)
      );
    }

    // Get messages
    const messages = await Message.getConversationMessages(conversationId, {
      page,
      limit,
      before,
      after
    });

    // Mark messages as read
    await conversation.markAsRead(userId);
    await conversation.updateLastSeen(userId);

    // Get total count for pagination
    const total = await Message.countDocuments({
      conversation: conversationId,
      isDeleted: false
    });

    res.json(apiResponse.success('Lấy tin nhắn thành công', {
      messages,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }));

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi lấy tin nhắn', 500)
    );
  }
};

// Send message
const sendMessage = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        apiResponse.error('Dữ liệu không hợp lệ', 400, errors.array())
      );
    }

    const { conversationId } = req.params;
    const { content, messageType = 'text', replyTo } = req.body;
    const userId = req.user.id;

    // Check if user is participant in conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy cuộc trò chuyện', 404)
      );
    }

    if (!conversation.isParticipant(userId)) {
      return res.status(403).json(
        apiResponse.error('Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này', 403)
      );
    }

    // Validate reply message if specified
    if (replyTo) {
      const replyMessage = await Message.findById(replyTo);
      if (!replyMessage || replyMessage.conversation.toString() !== conversationId) {
        return res.status(400).json(
          apiResponse.error('Tin nhắn được trả lời không hợp lệ', 400)
        );
      }
    }

    // Create message
    const message = new Message({
      conversation: conversationId,
      sender: userId,
      content,
      messageType,
      replyTo: replyTo || null
    });

    await message.save();

    // Populate message for response
    await message.populate('sender', 'name email role');
    if (replyTo) {
      await message.populate('replyTo', 'content sender');
    }

    // Emit real-time event (will be implemented with Socket.IO)
    // req.io.to(conversationId).emit('newMessage', message);

    res.status(201).json(
      apiResponse.success('Gửi tin nhắn thành công', message)
    );

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi gửi tin nhắn', 500)
    );
  }
};

// Edit message
const editMessage = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        apiResponse.error('Dữ liệu không hợp lệ', 400, errors.array())
      );
    }

    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy tin nhắn', 404)
      );
    }

    // Check if user is sender
    if (message.sender.toString() !== userId) {
      return res.status(403).json(
        apiResponse.error('Bạn chỉ có thể chỉnh sửa tin nhắn của mình', 403)
      );
    }

    // Check if message is not too old (e.g., 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      return res.status(400).json(
        apiResponse.error('Không thể chỉnh sửa tin nhắn quá 15 phút', 400)
      );
    }

    // Edit message
    await message.editMessage(content);

    // Populate for response
    await message.populate('sender', 'name email role');

    // Emit real-time event
    // req.io.to(message.conversation.toString()).emit('messageEdited', message);

    res.json(
      apiResponse.success('Chỉnh sửa tin nhắn thành công', message)
    );

  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi chỉnh sửa tin nhắn', 500)
    );
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy tin nhắn', 404)
      );
    }

    // Check if user is sender or admin
    if (message.sender.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json(
        apiResponse.error('Bạn không có quyền xóa tin nhắn này', 403)
      );
    }

    // Soft delete message
    await message.softDelete();

    // Emit real-time event
    // req.io.to(message.conversation.toString()).emit('messageDeleted', { messageId });

    res.json(
      apiResponse.success('Xóa tin nhắn thành công')
    );

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi xóa tin nhắn', 500)
    );
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy cuộc trò chuyện', 404)
      );
    }

    if (!conversation.isParticipant(userId)) {
      return res.status(403).json(
        apiResponse.error('Bạn không có quyền truy cập cuộc trò chuyện này', 403)
      );
    }

    // Mark as read
    await conversation.markAsRead(userId);
    await conversation.updateLastSeen(userId);

    // Mark all unread messages as read
    const unreadMessages = await Message.find({
      conversation: conversationId,
      sender: { $ne: userId },
      'readBy.user': { $ne: userId },
      isDeleted: false
    });

    for (const message of unreadMessages) {
      await message.markAsReadBy(userId);
    }

    res.json(
      apiResponse.success('Đánh dấu đã đọc thành công')
    );

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi đánh dấu đã đọc', 500)
    );
  }
};

// Add reaction to message
const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    // Validate emoji
    const validEmojis = ['👍', '❤️', '😊', '😂', '😮', '😢', '😡'];
    if (!validEmojis.includes(emoji)) {
      return res.status(400).json(
        apiResponse.error('Emoji không hợp lệ', 400)
      );
    }

    // Find message
    const message = await Message.findById(messageId);
    if (!message || message.isDeleted) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy tin nhắn', 404)
      );
    }

    // Check if user is participant in conversation
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation.isParticipant(userId)) {
      return res.status(403).json(
        apiResponse.error('Bạn không có quyền thêm reaction', 403)
      );
    }

    // Add reaction
    await message.addReaction(userId, emoji);

    // Populate for response
    await message.populate('reactions.user', 'name');

    res.json(
      apiResponse.success('Thêm reaction thành công', {
        messageId: message._id,
        reactions: message.reactions
      })
    );

  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi thêm reaction', 500)
    );
  }
};

// Search messages in conversation
const searchMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.user.id;

    if (!searchTerm || searchTerm.length < 2) {
      return res.status(400).json(
        apiResponse.error('Từ khóa tìm kiếm phải có ít nhất 2 ký tự', 400)
      );
    }

    // Check if user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy cuộc trò chuyện', 404)
      );
    }

    if (!conversation.isParticipant(userId)) {
      return res.status(403).json(
        apiResponse.error('Bạn không có quyền tìm kiếm trong cuộc trò chuyện này', 403)
      );
    }

    // Search messages
    const messages = await Message.searchMessages(conversationId, searchTerm, {
      page,
      limit
    });

    // Get total count
    const total = await Message.countDocuments({
      conversation: conversationId,
      content: { $regex: searchTerm, $options: 'i' },
      isDeleted: false
    });

    res.json(apiResponse.success('Tìm kiếm tin nhắn thành công', {
      messages,
      searchTerm,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }));

  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi tìm kiếm tin nhắn', 500)
    );
  }
};

module.exports = {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  addReaction,
  searchMessages
};