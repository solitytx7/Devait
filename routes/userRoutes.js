const express = require('express');
const router = express.Router();

const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  searchUsers
} = require('../controllers/userController');

const {
  userValidationRules,
  userUpdateValidationRules,
  validate
} = require('../middleware/validation');

// Search route should come before /:id to avoid conflicts
router.get('/search', searchUsers);

// CRUD routes
router.route('/')
  .get(getUsers)
  .post(userValidationRules(), validate, createUser);

router.route('/:id')
  .get(getUser)
  .put(userUpdateValidationRules(), validate, updateUser)
  .delete(deleteUser);

module.exports = router;