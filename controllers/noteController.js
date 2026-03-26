const Note = require('../models/Note');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const noteController = {
  // Tạo ghi chú mới
  createNote: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array()
        });
      }

      const { 
        lessonId, 
        title, 
        content, 
        timestamp, 
        color, 
        tags, 
        isPrivate 
      } = req.body;
      const userId = req.user.id;

      // Kiểm tra bài học có tồn tại
      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bài học'
        });
      }

      const note = new Note({
        userId,
        courseId: lesson.courseId,
        lessonId,
        title,
        content,
        timestamp,
        color,
        tags: tags ? tags.filter(tag => tag.trim() !== '') : [],
        isPrivate: isPrivate !== undefined ? isPrivate : true
      });

      await note.save();

      // Populate thông tin liên quan
      await note.populate([
        { path: 'lessonId', select: 'title duration order' },
        { path: 'courseId', select: 'name category' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Tạo ghi chú thành công',
        data: note
      });
    } catch (error) {
      console.error('Create note error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi tạo ghi chú'
      });
    }
  },

  // Lấy danh sách ghi chú theo bài học
  getNotesByLesson: async (req, res) => {
    try {
      const { lessonId } = req.params;
      const { includeArchived = 'false' } = req.query;
      const userId = req.user.id;

      const notes = await Note.getNotesByLesson(
        userId, 
        lessonId, 
        includeArchived === 'true'
      );

      res.json({
        success: true,
        data: notes
      });
    } catch (error) {
      console.error('Get notes by lesson error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy ghi chú'
      });
    }
  },

  // Lấy danh sách ghi chú theo khóa học
  getNotesByCourse: async (req, res) => {
    try {
      const { courseId } = req.params;
      const { includeArchived = 'false' } = req.query;
      const userId = req.user.id;

      const notes = await Note.getNotesByCourse(
        userId, 
        courseId, 
        includeArchived === 'true'
      );

      res.json({
        success: true,
        data: notes
      });
    } catch (error) {
      console.error('Get notes by course error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy ghi chú khóa học'
      });
    }
  },

  // Lấy tất cả ghi chú của user
  getAllNotes: async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        includeArchived = 'false', 
        page = 1, 
        limit = 20,
        sortBy = 'createdAt',
        order = 'desc',
        courseId,
        tags
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      let filter = { 
        userId,
        isArchived: includeArchived === 'true' ? undefined : false
      };

      // Lọc theo khóa học
      if (courseId) {
        filter.courseId = courseId;
      }

      // Lọc theo tags
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : tags.split(',');
        filter.tags = { $in: tagArray };
      }

      // Loại bỏ các trường undefined
      filter = Object.fromEntries(
        Object.entries(filter).filter(([_, value]) => value !== undefined)
      );

      const sortOrder = order === 'desc' ? -1 : 1;
      const sortObj = { isPinned: -1 }; // Pinned notes luôn ở đầu
      sortObj[sortBy] = sortOrder;

      const [notes, total] = await Promise.all([
        Note.find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit))
          .populate('lessonId', 'title duration order')
          .populate('courseId', 'name category'),
        Note.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          notes,
          pagination: {
            current: parseInt(page),
            total: Math.ceil(total / parseInt(limit)),
            count: total,
            perPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all notes error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách ghi chú'
      });
    }
  },

  // Cập nhật ghi chú
  updateNote: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array()
        });
      }

      const { noteId } = req.params;
      const { 
        title, 
        content, 
        timestamp, 
        color, 
        tags, 
        isPrivate, 
        isPinned 
      } = req.body;
      const userId = req.user.id;

      const note = await Note.findOne({ _id: noteId, userId });
      if (!note) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy ghi chú hoặc bạn không có quyền chỉnh sửa'
        });
      }

      // Cập nhật các trường được gửi
      if (title !== undefined) note.title = title;
      if (content !== undefined) note.content = content;
      if (timestamp !== undefined) note.timestamp = timestamp;
      if (color !== undefined) note.color = color;
      if (tags !== undefined) note.tags = tags.filter(tag => tag.trim() !== '');
      if (isPrivate !== undefined) note.isPrivate = isPrivate;
      if (isPinned !== undefined) note.isPinned = isPinned;

      await note.save();

      await note.populate([
        { path: 'lessonId', select: 'title duration order' },
        { path: 'courseId', select: 'name category' }
      ]);

      res.json({
        success: true,
        message: 'Cập nhật ghi chú thành công',
        data: note
      });
    } catch (error) {
      console.error('Update note error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi cập nhật ghi chú'
      });
    }
  },

  // Xóa ghi chú
  deleteNote: async (req, res) => {
    try {
      const { noteId } = req.params;
      const userId = req.user.id;

      const note = await Note.findOneAndDelete({ _id: noteId, userId });
      if (!note) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy ghi chú hoặc bạn không có quyền xóa'
        });
      }

      res.json({
        success: true,
        message: 'Xóa ghi chú thành công'
      });
    } catch (error) {
      console.error('Delete note error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi xóa ghi chú'
      });
    }
  },

  // Tìm kiếm ghi chú
  searchNotes: async (req, res) => {
    try {
      const { q: query, courseId, tags } = req.query;
      const userId = req.user.id;

      if (!query || query.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Từ khóa tìm kiếm là bắt buộc'
        });
      }

      let filters = {};
      if (courseId) filters.courseId = courseId;
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : tags.split(',');
        filters.tags = { $in: tagArray };
      }

      const notes = await Note.searchNotes(userId, query, filters);

      res.json({
        success: true,
        data: notes
      });
    } catch (error) {
      console.error('Search notes error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi tìm kiếm ghi chú'
      });
    }
  },

  // Lấy ghi chú theo tags
  getNotesByTags: async (req, res) => {
    try {
      const { tags } = req.query;
      const { includeArchived = 'false' } = req.query;
      const userId = req.user.id;

      if (!tags) {
        return res.status(400).json({
          success: false,
          message: 'Tags là bắt buộc'
        });
      }

      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      const notes = await Note.getNotesByTags(
        userId, 
        tagArray, 
        includeArchived === 'true'
      );

      res.json({
        success: true,
        data: notes
      });
    } catch (error) {
      console.error('Get notes by tags error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy ghi chú theo tags'
      });
    }
  },

  // Archive/Unarchive ghi chú
  toggleArchiveNote: async (req, res) => {
    try {
      const { noteId } = req.params;
      const userId = req.user.id;

      const note = await Note.findOne({ _id: noteId, userId });
      if (!note) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy ghi chú'
        });
      }

      note.isArchived = !note.isArchived;
      await note.save();

      res.json({
        success: true,
        message: note.isArchived ? 'Đã lưu trữ ghi chú' : 'Đã khôi phục ghi chú',
        data: { isArchived: note.isArchived }
      });
    } catch (error) {
      console.error('Toggle archive note error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lưu trữ ghi chú'
      });
    }
  },

  // Pin/Unpin ghi chú
  togglePinNote: async (req, res) => {
    try {
      const { noteId } = req.params;
      const userId = req.user.id;

      const note = await Note.findOne({ _id: noteId, userId });
      if (!note) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy ghi chú'
        });
      }

      note.isPinned = !note.isPinned;
      await note.save();

      res.json({
        success: true,
        message: note.isPinned ? 'Đã ghim ghi chú' : 'Đã bỏ ghim ghi chú',
        data: { isPinned: note.isPinned }
      });
    } catch (error) {
      console.error('Toggle pin note error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi ghim ghi chú'
      });
    }
  },

  // Lấy thống kê ghi chú
  getNotesStats: async (req, res) => {
    try {
      const userId = req.user.id;
      const { courseId } = req.query;

      const stats = await Note.getNotesStats(userId, courseId);
      const popularTags = await Note.getPopularTags(userId);

      res.json({
        success: true,
        data: {
          ...stats,
          popularTags
        }
      });
    } catch (error) {
      console.error('Get notes stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thống kê ghi chú'
      });
    }
  },

  // Lấy ghi chú chi tiết
  getNoteDetail: async (req, res) => {
    try {
      const { noteId } = req.params;
      const userId = req.user.id;

      const note = await Note.findOne({ _id: noteId, userId })
        .populate('lessonId', 'title duration order videoUrl')
        .populate('courseId', 'name category instructor');

      if (!note) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy ghi chú'
        });
      }

      res.json({
        success: true,
        data: note
      });
    } catch (error) {
      console.error('Get note detail error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy chi tiết ghi chú'
      });
    }
  }
};

module.exports = noteController;