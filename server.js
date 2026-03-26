require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

// Import Passport configuration
require('./config/passport');

// Debug: Testing security questions setup
console.log('🔧 Server starting with debug mode...');

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
const passport = require('passport');
app.use(passport.initialize());
app.use(passport.session());

app.use(logger);

// Make Socket.IO available in req object
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Serve static files from public directory
app.use(express.static('public'));

// Serve test HTML file
app.use('/test', express.static('./', {
  index: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
  }
}));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Node.js Web API',
    status: 'success',
    timestamp: new Date().toISOString(),
    endpoints: {
      users: '/api/users',
      userById: '/api/users/:id',
      searchUsers: '/api/users/search?q=keyword',
      courses: '/api/courses',
      courseById: '/api/courses/:id',
      searchCourses: '/api/courses/search?q=keyword',
      coursesByCategory: '/api/courses/category/:category',
      courseStats: '/api/courses/stats',
      comments: {
        getCourseComments: '/api/courses/:courseId/comments',
        createComment: '/api/courses/:courseId/comments',
        updateComment: '/api/comments/:commentId',
        deleteComment: '/api/comments/:commentId',
        getReplies: '/api/comments/:commentId/replies',
        likeComment: '/api/comments/:commentId/like',
        reportComment: '/api/comments/:commentId/report',
        commentStats: '/api/courses/:courseId/comments/stats'
      },
      chat: {
        getConversations: '/api/chat/conversations',
        getOrCreateConversation: '/api/chat/conversations/:courseId/instructor',
        getMessages: '/api/chat/conversations/:conversationId/messages',
        sendMessage: '/api/chat/conversations/:conversationId/messages',
        editMessage: '/api/chat/messages/:messageId',
        deleteMessage: '/api/chat/messages/:messageId',
        markAsRead: '/api/chat/conversations/:conversationId/read',
        addReaction: '/api/chat/messages/:messageId/reaction',
        searchMessages: '/api/chat/conversations/:conversationId/search'
      },
      auth: {
        register: '/api/auth/register',
        login: '/api/auth/login',
        logout: '/api/auth/logout',
        profile: '/api/auth/me',
        forgotPassword: '/api/auth/forgot-password',
        resetPassword: '/api/auth/reset-password/:token',
        users: '/api/auth/users (admin only)'
      },
      progress: {
        getCourseProgress: '/api/progress/course/:courseId',
        updateLessonProgress: '/api/progress/lesson/:lessonId',
        getUserStats: '/api/progress/stats',
        getRecentLessons: '/api/progress/recent',
        toggleBookmark: '/api/progress/bookmark/:lessonId',
        getBookmarkedLessons: '/api/progress/bookmarks',
        resetCourseProgress: '/api/progress/course/:courseId/reset'
      },
      notes: {
        createNote: '/api/notes',
        getAllNotes: '/api/notes',
        getNotesByLesson: '/api/notes/lesson/:lessonId',
        getNotesByCourse: '/api/notes/course/:courseId',
        searchNotes: '/api/notes/search',
        getNotesByTags: '/api/notes/tags',
        getNotesStats: '/api/notes/stats',
        getNoteDetail: '/api/notes/:noteId',
        updateNote: '/api/notes/:noteId',
        deleteNote: '/api/notes/:noteId',
        archiveNote: '/api/notes/:noteId/archive',
        pinNote: '/api/notes/:noteId/pin'
      },
      ai: {
        chatQuery: '/api/ai/chat',
        explainCode: '/api/ai/explain-code',
        getLearningRecommendations: '/api/ai/recommendations',
        generateQuiz: '/api/ai/generate-quiz',
        getChatHistory: '/api/ai/chat-history'
      },
      testInterface: '/test-courses',
      learningSystem: '/test-learning',
      learningStats: '/learning-stats',
      testProgressFeatures: '/test-progress',
      testAI: '/test-ai'
    }
  });
});

// Route for test interface
app.get('/test-courses', (req, res) => {
  res.sendFile(__dirname + '/test-courses.html');
});

// Route for learning system test interface
app.get('/test-learning', (req, res) => {
  res.sendFile(__dirname + '/test-learning.html');
});

// Route for learning stats page
app.get('/learning-stats', (req, res) => {
  res.sendFile(__dirname + '/public/learning-stats.html');
});

// Route for test progress features page
app.get('/test-progress', (req, res) => {
  res.sendFile(__dirname + '/public/test-progress-features.html');
});

// Route for test AI assistant page
app.get('/test-ai', (req, res) => {
  res.sendFile(__dirname + '/public/test-ai-assistant.html');
});

// API Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api', require('./routes/commentRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/lessons', require('./routes/lessonRoutes'));
app.use('/api/enrollments', require('./routes/enrollmentRoutes'));
app.use('/api/progress', require('./routes/progressRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

// Handle 404 - this should come before error handler
app.use((req, res, next) => {
  res.status(404).json({
    message: 'Route not found',
    status: 'error'
  });
});

// Error handling middleware - this should be last
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Socket.IO connection handling
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('👋 User connected:', socket.id);
  
  // Handle user joining (authentication)
  socket.on('join', (userData) => {
    if (userData && userData.userId) {
      socket.userId = userData.userId;
      socket.userName = userData.name;
      onlineUsers.set(userData.userId, {
        socketId: socket.id,
        name: userData.name,
        lastSeen: new Date()
      });
      
      // Broadcast online users update
      io.emit('onlineUsers', Array.from(onlineUsers.values()));
      console.log(`📱 ${userData.name} joined chat`);
    }
  });
  
  // Handle joining conversation rooms
  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`💬 User ${socket.userId} joined conversation ${conversationId}`);
  });
  
  // Handle leaving conversation rooms
  socket.on('leaveConversation', (conversationId) => {
    socket.leave(conversationId);
    console.log(`👋 User ${socket.userId} left conversation ${conversationId}`);
  });
  
  // Handle typing indicators
  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(conversationId).emit('userTyping', {
      userId: socket.userId,
      userName: socket.userName,
      isTyping
    });
  });
  
  // Handle message reactions in real-time
  socket.on('messageReaction', (data) => {
    socket.to(data.conversationId).emit('reactionUpdate', data);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('👋 User disconnected:', socket.id);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      // Broadcast online users update
      io.emit('onlineUsers', Array.from(onlineUsers.values()));
      console.log(`📱 ${socket.userName} left chat`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}`);
  console.log(`Socket.IO enabled for real-time chat`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Export io for use in other modules
module.exports = { app, io };