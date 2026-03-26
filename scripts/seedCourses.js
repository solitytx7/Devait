const mongoose = require('mongoose');
const Course = require('../models/Course');

// Load .env if present
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your_db_name';

const sampleCourses = [
  {
    name: 'JavaScript ES6 cơ bản',
    description: 'Học cú pháp ES6 và các tính năng hiện đại như arrow functions, let/const, modules.',
    image: '',
    video: '',
    price: 0,
    duration: 240,
    level: 'Beginner',
    category: 'Web Development',
    instructor: 'Admin',
    rating: 4.5,
    studentsCount: 120,
    isPublished: true,
    tags: ['javascript', 'es6']
  },
  {
    name: 'HTML & CSS Responsive',
    description: 'Thiết kế giao diện responsive bằng Flexbox và CSS Grid.',
    duration: 180,
    level: 'Beginner',
    category: 'Web Design',
    instructor: 'Admin',
    isPublished: true,
    tags: ['html', 'css', 'responsive']
  },
  {
    name: 'Node.js & Express',
    description: 'Xây dựng backend với Node.js, Express và MongoDB.',
    duration: 360,
    level: 'Intermediate',
    category: 'Backend',
    instructor: 'Admin',
    isPublished: true,
    tags: ['nodejs', 'express', 'mongodb']
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB:', MONGODB_URI);

    // Remove existing sample courses with same names to avoid duplicates
    const names = sampleCourses.map(c => c.name);
    await Course.deleteMany({ name: { $in: names } });

    const created = await Course.insertMany(sampleCourses);
    console.log('Inserted sample courses:', created.map(c => c.name));

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB. Seeding complete.');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
