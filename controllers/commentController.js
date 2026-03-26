const Comment = require('../models/Comment');
const Course = require('../models/Course');
const User = require('../models/User');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const apiResponse = require('../utils/apiResponse');

// Get comments for a course
const getComments = async (req, res) => {
  try {
    const { courseId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy khóa học', 404)
      );
    }

    // Get comments with pagination
    const comments = await Comment.getCommentsForCourse(courseId, {
      page,
      limit,
      sortBy,
      sortOrder
    });

    // Get total count for pagination
    const total = await Comment.countDocuments({
      course: courseId,
      parentComment: null,
      isActive: true
    });

    // Populate replies count for each comment
    await Comment.populate(comments, { path: 'repliesCount' });

    res.json(apiResponse.success('Lấy danh sách bình luận thành công', {
      comments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }));

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi lấy bình luận', 500)
    );
  }
};

// Get replies for a comment
const getReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;

    // Check if parent comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy bình luận', 404)
      );
    }

    // Get replies
    const replies = await Comment.getRepliesForComment(commentId, {
      page,
      limit
    });

    // Get total count for pagination
    const total = await Comment.countDocuments({
      parentComment: commentId,
      isActive: true
    });

    res.json(apiResponse.success('Lấy danh sách phản hồi thành công', {
      replies,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }));

  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi lấy phản hồi', 500)
    );
  }
};

// Create a new comment
const createComment = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        apiResponse.error('Dữ liệu không hợp lệ', 400, errors.array())
      );
    }

    const { courseId } = req.params;
    const { content, parentComment } = req.body;
    const userId = req.user.id;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy khóa học', 404)
      );
    }

    // If this is a reply, check if parent comment exists
    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (!parent) {
        return res.status(404).json(
          apiResponse.error('Không tìm thấy bình luận gốc', 404)
        );
      }
      
      // Make sure parent comment belongs to the same course
      if (parent.course.toString() !== courseId) {
        return res.status(400).json(
          apiResponse.error('Bình luận gốc không thuộc khóa học này', 400)
        );
      }
    }

    // Create comment
    const comment = new Comment({
      content,
      user: userId,
      course: courseId,
      parentComment: parentComment || null
    });

    await comment.save();

    // Populate user info
    await comment.populate('user', 'name email');

    res.status(201).json(
      apiResponse.success('Tạo bình luận thành công', comment)
    );

  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi tạo bình luận', 500)
    );
  }
};

// Update a comment
const updateComment = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        apiResponse.error('Dữ liệu không hợp lệ', 400, errors.array())
      );
    }

    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Find comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy bình luận', 404)
      );
    }

    // Check if user owns the comment
    if (comment.user.toString() !== userId) {
      return res.status(403).json(
        apiResponse.error('Bạn không có quyền chỉnh sửa bình luận này', 403)
      );
    }

    // Update comment
    comment.content = content;
    await comment.save();

    // Populate user info
    await comment.populate('user', 'name email');

    res.json(
      apiResponse.success('Cập nhật bình luận thành công', comment)
    );

  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi cập nhật bình luận', 500)
    );
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy bình luận', 404)
      );
    }

    // Check if user owns the comment or is admin
    if (comment.user.toString() !== userId && userRole !== 'admin') {
      return res.status(403).json(
        apiResponse.error('Bạn không có quyền xóa bình luận này', 403)
      );
    }

    // Soft delete (set isActive to false)
    comment.isActive = false;
    await comment.save();

    // Also soft delete all replies
    await Comment.updateMany(
      { parentComment: commentId },
      { isActive: false }
    );

    res.json(
      apiResponse.success('Xóa bình luận thành công')
    );

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi xóa bình luận', 500)
    );
  }
};

// Like/Unlike a comment
const toggleLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Find comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy bình luận', 404)
      );
    }

    // Check if user already liked this comment
    const isLiked = comment.isLikedByUser(userId);

    if (isLiked) {
      // Remove like
      await comment.removeLike(userId);
    } else {
      // Add like
      await comment.addLike(userId);
    }

    // Get updated comment with populated data
    const updatedComment = await Comment.findById(commentId)
      .populate('user', 'name email')
      .populate('likes.user', 'name');

    res.json(
      apiResponse.success(
        isLiked ? 'Bỏ thích bình luận thành công' : 'Thích bình luận thành công',
        {
          comment: updatedComment,
          isLiked: !isLiked,
          likesCount: updatedComment.likesCount
        }
      )
    );

  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi thích/bỏ thích bình luận', 500)
    );
  }
};

// Report a comment
const reportComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    // Find comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json(
        apiResponse.error('Không tìm thấy bình luận', 404)
      );
    }

    // Check if user already reported this comment
    const alreadyReported = comment.reportedBy.some(
      report => report.user.toString() === userId
    );

    if (alreadyReported) {
      return res.status(400).json(
        apiResponse.error('Bạn đã báo cáo bình luận này rồi', 400)
      );
    }

    // Add report
    comment.reportedBy.push({
      user: userId,
      reason: reason || 'Không phù hợp'
    });

    // Mark as reported if it has multiple reports
    if (comment.reportedBy.length >= 3) {
      comment.isReported = true;
    }

    await comment.save();

    res.json(
      apiResponse.success('Báo cáo bình luận thành công')
    );

  } catch (error) {
    console.error('Report comment error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi báo cáo bình luận', 500)
    );
  }
};

// Get comment statistics for admin
const getCommentStats = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Total comments
    const totalComments = await Comment.countDocuments({
      course: courseId,
      isActive: true
    });

    // Root comments (not replies)
    const rootComments = await Comment.countDocuments({
      course: courseId,
      parentComment: null,
      isActive: true
    });

    // Replies
    const replies = totalComments - rootComments;

    // Reported comments
    const reportedComments = await Comment.countDocuments({
      course: courseId,
      isReported: true,
      isActive: true
    });

    // Top commenters
    const topCommenters = await Comment.aggregate([
      { $match: { course: mongoose.Types.ObjectId(courseId), isActive: true } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          user: { name: '$user.name', email: '$user.email' },
          count: 1
        }
      }
    ]);

    res.json(
      apiResponse.success('Lấy thống kê bình luận thành công', {
        totalComments,
        rootComments,
        replies,
        reportedComments,
        topCommenters
      })
    );

  } catch (error) {
    console.error('Get comment stats error:', error);
    res.status(500).json(
      apiResponse.error('Lỗi server khi lấy thống kê bình luận', 500)
    );
  }
};

module.exports = {
  getComments,
  getReplies,
  createComment,
  updateComment,
  deleteComment,
  toggleLike,
  reportComment,
  getCommentStats
};