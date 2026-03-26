# Node.js Web API với Mongoose

Một dự án API RESTful được xây dựng bằng Node.js, Express và MongoDB/Mongoose.

## Tính năng

- ✅ RESTful API với CRUD operations
- ✅ MongoDB integration với Mongoose
- ✅ User management với authentication
- ✅ Course management với file upload
- ✅ Error handling middleware
- ✅ Request logging
- ✅ Input validation với express-validator
- ✅ Password hashing với bcryptjs
- ✅ File upload với multer (hình ảnh & video)
- ✅ Pagination và search functionality
- ✅ Environment configuration

## Cài đặt

1. Clone repository này
2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

4. Cập nhật thông tin database trong file `.env`:
```
MONGODB_URI=mongodb://localhost:27017/nodejs-web-api
```

5. Đảm bảo MongoDB đã được cài đặt và đang chạy

## Chạy ứng dụng

### Development mode
```bash
npm run dev
```

### Production mode
```bash
npm start
```

Server sẽ chạy tại `http://localhost:3000`

## API Endpoints

### Users
- `GET /api/users` - Lấy danh sách users (có pagination)
- `GET /api/users/:id` - Lấy thông tin user theo ID
- `POST /api/users` - Tạo user mới
- `PUT /api/users/:id` - Cập nhật user
- `DELETE /api/users/:id` - Xóa user
- `GET /api/users/search?q=keyword` - Tìm kiếm users

### Courses
- `GET /api/courses` - Lấy danh sách khóa học (có pagination & filter)
- `GET /api/courses/:id` - Lấy thông tin khóa học theo ID
- `POST /api/courses` - Tạo khóa học mới (hỗ trợ upload file)
- `PUT /api/courses/:id` - Cập nhật khóa học (hỗ trợ upload file)
- `DELETE /api/courses/:id` - Xóa khóa học
- `GET /api/courses/search?q=keyword` - Tìm kiếm khóa học
- `GET /api/courses/category/:category` - Lấy khóa học theo danh mục
- `GET /api/courses/stats` - Thống kê khóa học

### Course Query Parameters
- `category` - Lọc theo danh mục
- `level` - Lọc theo cấp độ (Beginner, Intermediate, Advanced)
- `minPrice` & `maxPrice` - Lọc theo khoảng giá
- `published` - Lọc theo trạng thái xuất bản
- `page` & `limit` - Phân trang

### Example User Object
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123",
  "age": 30,
  "phone": "1234567890",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "role": "user"
}
```

### Example Course Object
```json
{
  "name": "Node.js cho người mới bắt đầu",
  "description": "Khóa học Node.js từ cơ bản đến nâng cao",
  "image": "https://example.com/course-image.jpg",
  "video": "https://example.com/course-video.mp4",
  "price": 299000,
  "duration": 1200,
  "level": "Beginner",
  "category": "Lập trình",
  "instructor": "Nguyễn Văn A",
  "rating": 4.5,
  "studentsCount": 150,
  "isPublished": true,
  "tags": ["nodejs", "javascript", "backend"]
}
```

## Cấu trúc dự án

```
├── config/
│   └── database.js          # Cấu hình kết nối MongoDB
├── controllers/
│   ├── userController.js    # Controller cho User
│   └── courseController.js  # Controller cho Course
├── middleware/
│   ├── errorHandler.js      # Error handling middleware
│   ├── logger.js           # Request logging middleware
│   ├── validation.js       # Input validation middleware
│   └── upload.js           # File upload middleware (multer)
├── models/
│   ├── User.js             # Mongoose model cho User
│   └── Course.js           # Mongoose model cho Course
├── routes/
│   ├── userRoutes.js       # Routes cho User API
│   └── courseRoutes.js     # Routes cho Course API
├── uploads/
│   ├── images/             # Thư mục lưu hình ảnh
│   └── videos/             # Thư mục lưu video
├── utils/
│   └── apiResponse.js      # Utility functions cho API responses
├── .env                    # Environment variables
├── .env.example           # Environment variables template
├── .gitignore
├── package.json
├── README.md
├── API_TESTS.md           # Hướng dẫn test API
├── test-courses.html      # Demo web interface
└── server.js              # Entry point
```

## File Upload

API hỗ trợ upload hình ảnh và video cho khóa học:

- **Hình ảnh**: Tối đa 5MB, các định dạng: jpg, png, gif, etc.
- **Video**: Tối đa 100MB, các định dạng: mp4, avi, mov, etc.
- **Field names**: `image` và `video`
- **Upload path**: `/uploads/images/` và `/uploads/videos/`

### Upload example với curl:
```bash
curl -X POST http://localhost:3000/api/courses \
  -F "name=React cho người mới bắt đầu" \
  -F "description=Khóa học React cơ bản" \
  -F "price=399000" \
  -F "duration=1800" \
  -F "level=Beginner" \
  -F "category=Frontend" \
  -F "instructor=Trần Thị B" \
  -F "image=@/path/to/course-image.jpg" \
  -F "video=@/path/to/course-video.mp4"
```

## Testing

1. **API Tests**: Xem file `API_TESTS.md` để có hướng dẫn chi tiết về cách test API
2. **Web Interface**: Mở file `test-courses.html` trong trình duyệt để test giao diện web
3. **Postman**: Import các endpoint vào Postman để test

## Environment Variables

```
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/nodejs-web-api
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=30d
API_VERSION=v1
```

## Testing API

Bạn có thể test API bằng cách sử dụng:
- Postman
- Thunder Client (VS Code extension)
- curl commands
- Web interface (`test-courses.html`)

### Example API calls:

1. **Tạo user mới:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "Password123",
    "age": 30
  }'
```

2. **Lấy danh sách users:**
```bash
curl http://localhost:3000/api/users
```

3. **Tạo khóa học mới:**
```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Node.js cho người mới bắt đầu",
    "description": "Khóa học Node.js từ cơ bản đến nâng cao",
    "image": "https://example.com/nodejs-course.jpg",
    "video": "https://example.com/nodejs-intro.mp4",
    "price": 299000,
    "duration": 1200,
    "level": "Beginner",
    "category": "Lập trình",
    "instructor": "Nguyễn Văn A"
  }'
```

## Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **multer** - File upload middleware
- **bcryptjs** - Password hashing
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variables
- **express-validator** - Input validation
- **jsonwebtoken** - JWT token (for future auth features)

## License

ISC