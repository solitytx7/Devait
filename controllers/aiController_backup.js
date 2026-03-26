const OpenAI = require('openai');
const { CohereClient } = require('cohere-ai');
const Progress = require('../models/Progress');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');

// Initialize AI clients
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'demo-key'
});

const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY || 'demo-key'
});

// Mock responses for demo purposes when API keys are not available
const mockResponses = {
    chatResponse: {
        answer: "Đây là câu trả lời demo từ AI. Để sử dụng AI thật, vui lòng cấu hình API key trong file .env",
        suggestions: [
            "Bạn có thể hỏi về JavaScript",
            "Tìm hiểu về React.js",
            "Học về Node.js"
        ]
    },
    codeExplanation: {
        explanation: "Đây là giải thích demo về code. Code này có vẻ đơn giản và hoạt động tốt.",
        issues: [],
        suggestions: ["Thêm comments", "Sử dụng const thay vì let"]
    },
    learningRecommendation: {
        recommendations: [
            {
                courseId: "demo-1",
                title: "JavaScript Nâng cao",
                reason: "Dựa trên tiến độ học của bạn"
            },
            {
                courseId: "demo-2", 
                title: "React.js Fundamentals",
                reason: "Phù hợp với kiến thức hiện tại"
            }
        ]
    },
    quizGeneration: {
        questions: [
            {
                question: "JavaScript là gì?",
                options: ["Ngôn ngữ lập trình", "Framework", "Database", "IDE"],
                correctAnswer: 0,
                explanation: "JavaScript là một ngôn ngữ lập trình phổ biến"
            }
        ]
    }
};

// Chat hỏi bài - AI trả lời câu hỏi về lập trình
exports.chatQuery = async (req, res) => {
    try {
        const { question, context = '', courseId = null } = req.body;
        const userId = req.user?.id;

        if (!question) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập câu hỏi'
            });
        }

        let response;

        // Try using OpenAI if API key is available
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'demo-key') {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: `Bạn là một trợ lý AI chuyên về lập trình và giáo dục. Hãy trả lời các câu hỏi một cách chi tiết, dễ hiểu và hữu ích. 
                            Context: ${context}
                            Trả lời bằng tiếng Việt.`
                        },
                        {
                            role: "user",
                            content: question
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                });

                response = {
                    answer: completion.choices[0].message.content,
                    suggestions: [
                        "Bạn có muốn tìm hiểu thêm về chủ đề này không?",
                        "Có câu hỏi nào khác về lập trình không?",
                        "Bạn muốn xem ví dụ code thực tế không?"
                    ]
                };
            } catch (error) {
                console.error('OpenAI API Error:', error);
                response = mockResponses.chatResponse;
            }
        } 
        // Try using Cohere if OpenAI fails or not available
        else if (process.env.COHERE_API_KEY && process.env.COHERE_API_KEY !== 'demo-key') {
            try {
                const cohereResponse = await cohere.chat({
                    message: `Context: ${context}\n\nCâu hỏi: ${question}\n\nHãy trả lời bằng tiếng Việt một cách chi tiết và dễ hiểu.`,
                    model: "command-light"
                });

                response = {
                    answer: cohereResponse.text,
                    suggestions: [
                        "Bạn có muốn tìm hiểu thêm về chủ đề này không?",
                        "Có câu hỏi nào khác về lập trình không?",
                        "Bạn muốn xem ví dụ code thực tế không?"
                    ]
                };
            } catch (error) {
                console.error('Cohere API Error:', error);
                response = mockResponses.chatResponse;
            }
        } else {
            // Use mock response if no API keys available
            response = mockResponses.chatResponse;
        }

        // Save chat history if user is logged in
        if (userId) {
            // TODO: Implement chat history saving
        }

        res.json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error('Chat Query Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xử lý câu hỏi'
        });
    }
};

// Giải thích code - AI phân tích và giải thích code
exports.explainCode = async (req, res) => {
    try {
        const { code, language = 'javascript' } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập code cần giải thích'
            });
        }

        let response;

        // Try using OpenAI
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'demo-key') {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: `Bạn là một chuyên gia lập trình. Hãy phân tích code sau và:
                            1. Giải thích code hoạt động như thế nào
                            2. Tìm các lỗi hoặc vấn đề tiềm ẩn
                            3. Đưa ra gợi ý cải thiện
                            Trả lời bằng tiếng Việt, có cấu trúc và dễ hiểu.`
                        },
                        {
                            role: "user",
                            content: `Language: ${language}\n\nCode:\n${code}`
                        }
                    ],
                    max_tokens: 1500,
                    temperature: 0.5
                });

                const aiResponse = completion.choices[0].message.content;
                
                // Parse response to extract different sections
                response = {
                    explanation: aiResponse,
                    issues: [],
                    suggestions: []
                };
                
                // Try to extract issues and suggestions from response
                if (aiResponse.toLowerCase().includes('lỗi') || aiResponse.toLowerCase().includes('vấn đề')) {
                    response.issues = ['Có thể có vấn đề trong code, xem giải thích chi tiết'];
                }
                if (aiResponse.toLowerCase().includes('gợi ý') || aiResponse.toLowerCase().includes('cải thiện')) {
                    response.suggestions = ['Xem gợi ý cải thiện trong phần giải thích'];
                }

            } catch (error) {
                console.error('OpenAI API Error:', error);
                response = mockResponses.codeExplanation;
            }
        } else {
            // Use mock response
            response = {
                ...mockResponses.codeExplanation,
                explanation: `Giải thích code ${language}:\n\nCode này có vẻ đơn giản và dễ hiểu. Để có phân tích chi tiết hơn, vui lòng cấu hình API key OpenAI trong file .env.`
            };
        }

        res.json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error('Code Explanation Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi giải thích code'
        });
    }
};

// Gợi ý lộ trình - AI dựa trên lịch sử học để đề xuất
exports.getLearningRecommendations = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập để nhận gợi ý học tập'
            });
        }

        // Get user's learning progress
        const userProgress = await Progress.find({ userId })
            .populate('courseId')
            .populate('lessonId')
            .sort({ lastAccessed: -1 })
            .limit(10);

        // Get user's enrollments
        const enrollments = await Enrollment.find({ 
            userId
        }).populate('courseId');

        // Get all available courses
        const allCourses = await Course.find({ isPublished: true }).limit(20);

        let recommendations;

        // Try using AI to generate smart recommendations
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'demo-key') {
            try {
                // Prepare user learning context
                const learningContext = {
                    completedCourses: enrollments.filter(e => e.progress >= 90).map(e => e.courseId.title),
                    inProgressCourses: enrollments.filter(e => e.progress < 90).map(e => e.courseId.title),
                    recentLessons: userProgress.slice(0, 5).map(p => p.lessonId?.title).filter(Boolean),
                    categories: [...new Set(enrollments.map(e => e.courseId.category))]
                };

                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: `Bạn là một tư vấn giáo dục AI. Dựa trên dữ liệu học tập của người dùng, hãy đưa ra 3-5 gợi ý khóa học phù hợp.
                            Trả lời bằng JSON format với mảng recommendations, mỗi item có: title, reason, category, priority (1-5)`
                        },
                        {
                            role: "user",
                            content: `Dữ liệu học tập của user:\n${JSON.stringify(learningContext, null, 2)}\n\nCác khóa học có sẵn:\n${allCourses.map(c => `${c.title} (${c.category})`).join('\n')}`
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                });

                try {
                    const aiRecommendations = JSON.parse(completion.choices[0].message.content);
                    recommendations = aiRecommendations.recommendations || [];
                } catch (parseError) {
                    recommendations = mockResponses.learningRecommendation.recommendations;
                }

            } catch (error) {
                console.error('OpenAI Recommendation Error:', error);
                recommendations = mockResponses.learningRecommendation.recommendations;
            }
        } else {
            // Use rule-based recommendations
            recommendations = [];
            
            // Create basic recommendations based on available courses
            recommendations = [];
            
            // Get user's most common category if enrollments exist
            let topCategory = 'Programming'; // default
            if (enrollments.length > 0) {
                const categoryCount = {};
                enrollments.forEach(e => {
                    if (e.courseId && e.courseId.category) {
                        categoryCount[e.courseId.category] = (categoryCount[e.courseId.category] || 0) + 1;
                    }
                });
                const categories = Object.keys(categoryCount);
                if (categories.length > 0) {
                    topCategory = categories.sort((a, b) => categoryCount[b] - categoryCount[a])[0];
                }
            }

            // Recommend courses from the same category
            const sameCategoryCourses = allCourses.filter(c => 
                c.category === topCategory && 
                !enrollments.some(e => e.courseId && e.courseId._id && e.courseId._id.equals(c._id))
            ).slice(0, 3);

            recommendations = sameCategoryCourses.map(course => ({
                courseId: course._id,
                title: course.name || course.title,
                category: course.category,
                reason: `Phù hợp với sở thích học ${topCategory} của bạn`,
                priority: 4
            }));

            // Add trending courses if not enough recommendations
            if (recommendations.length < 3) {
                const trendingCourses = allCourses
                    .filter(c => !enrollments.some(e => e.courseId && e.courseId._id && e.courseId._id.equals(c._id)))
                    .sort((a, b) => (b.studentsCount || 0) - (a.studentsCount || 0))
                    .slice(0, 3 - recommendations.length);

                trendingCourses.forEach(course => {
                    recommendations.push({
                        courseId: course._id,
                        title: course.name || course.title,
                        category: course.category,
                        reason: "Khóa học phổ biến trong cộng đồng",
                        priority: 3
                    });
                });
            }

            // Add demo recommendations if still not enough
            if (recommendations.length === 0) {
                recommendations = [
                    {
                        courseId: 'demo-1',
                        title: 'JavaScript Nâng cao',
                        category: 'Programming',
                        reason: 'Phù hợp để nâng cao kỹ năng lập trình',
                        priority: 4
                    },
                    {
                        courseId: 'demo-2',
                        title: 'React.js Fundamentals',
                        category: 'Programming', 
                        reason: 'Framework phổ biến để phát triển web',
                        priority: 3
                    },
                    {
                        courseId: 'demo-3',
                        title: 'Node.js Backend Development',
                        category: 'Programming',
                        reason: 'Học backend development với JavaScript',
                        priority: 3
                    }
                ];
            }
        }

        res.json({
            success: true,
            data: {
                recommendations,
                userStats: {
                    totalCourses: enrollments.length,
                    completedCourses: enrollments.filter(e => e.progress >= 90).length,
                    totalLessons: userProgress.length,
                    favoriteCategory: enrollments.length > 0 ? 
                        Object.keys(enrollments.reduce((acc, e) => {
                            if (e.courseId && e.courseId.category) {
                                acc[e.courseId.category] = (acc[e.courseId.category] || 0) + 1;
                            }
                            return acc;
                        }, {})).sort((a, b) => 
                            enrollments.filter(e => e.courseId && e.courseId.category === b).length - 
                            enrollments.filter(e => e.courseId && e.courseId.category === a).length
                        )[0] || 'Programming' : 'Programming'
                }
            }
        });

    } catch (error) {
        console.error('Learning Recommendations Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi tạo gợi ý học tập'
        });
    }
};

// Sinh câu hỏi trắc nghiệm - AI tạo quiz cho bài học
exports.generateQuiz = async (req, res) => {
    try {
        const { lessonId, questionCount = 5, difficulty = 'medium' } = req.body;

        if (!lessonId) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp ID bài học'
            });
        }

        // Handle demo lesson ID
        if (lessonId === 'demo-lesson-id') {
            const demoQuestions = [
                {
                    question: "JavaScript là gì?",
                    options: ["Ngôn ngữ lập trình", "Framework", "Database", "IDE"],
                    correctAnswer: 0,
                    explanation: "JavaScript là một ngôn ngữ lập trình phổ biến được sử dụng chủ yếu để phát triển web"
                },
                {
                    question: "Cách khai báo biến trong JavaScript ES6?",
                    options: ["var name", "let name", "const name", "Tất cả đều đúng"],
                    correctAnswer: 3,
                    explanation: "ES6 hỗ trợ cả var, let và const để khai báo biến"
                },
                {
                    question: "Hàm nào được dùng để in ra console?",
                    options: ["print()", "console.log()", "echo()", "write()"],
                    correctAnswer: 1,
                    explanation: "console.log() là hàm chuẩn để in ra console trong JavaScript"
                }
            ];

            return res.json({
                success: true,
                data: {
                    lessonId: lessonId,
                    lessonTitle: "Demo JavaScript Basics",
                    questions: demoQuestions.slice(0, questionCount),
                    metadata: {
                        difficulty,
                        questionCount: Math.min(demoQuestions.length, questionCount),
                        estimatedTime: Math.min(demoQuestions.length, questionCount) * 2
                    }
                }
            });
        }

        // Get lesson content
        const lesson = await Lesson.findById(lessonId).populate('courseId');
        
        if (!lesson) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài học'
            });
        }

        let questions;

        // Try using OpenAI to generate quiz
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'demo-key') {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: `Bạn là một chuyên gia tạo câu hỏi trắc nghiệm. Dựa trên nội dung bài học, hãy tạo ${questionCount} câu hỏi trắc nghiệm mức độ ${difficulty}.
                            Trả lời bằng JSON format:
                            {
                                "questions": [
                                    {
                                        "question": "Câu hỏi",
                                        "options": ["A", "B", "C", "D"],
                                        "correctAnswer": 0,
                                        "explanation": "Giải thích đáp án"
                                    }
                                ]
                            }`
                        },
                        {
                            role: "user",
                            content: `Bài học: ${lesson.title}\nNội dung: ${lesson.content || 'Nội dung bài học về ' + lesson.title}\nKhóa học: ${lesson.courseId.title}`
                        }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                });

                try {
                    const quizData = JSON.parse(completion.choices[0].message.content);
                    questions = quizData.questions || [];
                } catch (parseError) {
                    questions = mockResponses.quizGeneration.questions;
                }

            } catch (error) {
                console.error('OpenAI Quiz Generation Error:', error);
                questions = mockResponses.quizGeneration.questions;
            }
        } else {
            // Generate basic quiz based on lesson title and category
            const category = lesson.courseId ? lesson.courseId.category : 'Programming';
            const lessonTitle = lesson.title || 'Bài học';
            
            questions = [
                {
                    question: `Bài học "${lessonTitle}" thuộc chủ đề gì?`,
                    options: [category, "Web Design", "Database", "Mobile App"],
                    correctAnswer: 0,
                    explanation: `Bài học này thuộc về ${category}`
                },
                {
                    question: `Kỹ năng chính được học trong "${lessonTitle}" là gì?`,
                    options: ["Lập trình", "Thiết kế", "Quản lý", "Marketing"],
                    correctAnswer: 0,
                    explanation: "Đây là kỹ năng lập trình cơ bản"
                },
                {
                    question: `Để hiểu rõ nội dung của "${lessonTitle}", bạn cần?`,
                    options: ["Thực hành nhiều", "Chỉ xem video", "Bỏ qua lý thuyết", "Học vội vàng"],
                    correctAnswer: 0,
                    explanation: "Thực hành là cách tốt nhất để hiểu và ghi nhớ kiến thức"
                }
            ].slice(0, questionCount);
        }

        res.json({
            success: true,
            data: {
                lessonId,
                lessonTitle: lesson.title,
                questions,
                metadata: {
                    difficulty,
                    questionCount: questions.length,
                    estimatedTime: questions.length * 2 // 2 minutes per question
                }
            }
        });

    } catch (error) {
        console.error('Quiz Generation Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi tạo câu hỏi'
        });
    }
};

// Get AI chat history
exports.getChatHistory = async (req, res) => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập'
            });
        }

        // TODO: Implement chat history from database
        // For now, return empty history
        res.json({
            success: true,
            data: {
                history: [],
                message: "Lịch sử chat sẽ được lưu trong các phiên bản tiếp theo"
            }
        });

    } catch (error) {
        console.error('Get Chat History Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy lịch sử chat'
        });
    }
};

module.exports = {
    chatQuery: exports.chatQuery,
    explainCode: exports.explainCode,
    getLearningRecommendations: exports.getLearningRecommendations,
    generateQuiz: exports.generateQuiz,
    getChatHistory: exports.getChatHistory
};