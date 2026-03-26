const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const auth = require('../middleware/auth');

// Routes cho AI Assistant

// Chat hỏi bài - AI trả lời câu hỏi về lập trình
router.post('/chat', auth.optional, aiController.chatQuery);

// Giải thích code - AI phân tích và giải thích code  
router.post('/explain-code', auth.optional, aiController.explainCode);

// Gợi ý lộ trình - AI dựa trên lịch sử học để đề xuất khóa học/lộ trình
router.get('/recommendations', auth.optional, aiController.getLearningRecommendations);
router.post('/recommendations', auth.optional, aiController.getLearningRecommendations);
// Static test endpoint for UI testing
router.get('/recommendations/test', auth.optional, aiController.getRecommendationsTest);

// Sinh câu hỏi trắc nghiệm - AI tạo quiz cho bài học
router.post('/generate-quiz', auth.optional, aiController.generateQuiz);

// Lấy lịch sử chat với AI (tạm thời bỏ function này)
// router.get('/chat-history', auth.required, aiController.getChatHistory);

module.exports = router;