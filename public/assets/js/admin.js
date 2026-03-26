// Admin Application State
const AdminState = {
    courses: [],
    users: [],
    currentEditId: null,
    currentDeleteId: null,
    tags: [],
    isLoading: false,
    userPagination: {
        currentPage: 1,
        totalPages: 1,
        limit: 10
    }
};

// Admin API Service extending the main APIService
class AdminAPIService extends APIService {
    // Helper method to get authenticated headers
    static getAuthHeaders(includeContentType = false) {
        const token = localStorage.getItem('token');
        const headers = {};
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }
        
        return headers;
    }

    // Helper method for authenticated fetch
    static async authFetch(url, options = {}) {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Not authorized, no token');
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        if (options.body && typeof options.body === 'string') {
            headers['Content-Type'] = 'application/json';
        }

        return fetch(url, {
            ...options,
            headers
        });
    }
    static async getAllCourses(params = {}) {
        try {
            console.log('AdminAPIService.getAllCourses called with params:', params);
            const queryString = new URLSearchParams({
                ...params,
                includeUnpublished: true,
                limit: 100
            }).toString();
            
            const url = `/api/courses?${queryString}`;
            console.log('Making request to:', url);
            
            // Prepare headers
            const headers = {};
            const token = localStorage.getItem('token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('Using auth token for request');
            } else {
                console.log('No auth token, making public request');
            }
            
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                console.error('Response not OK:', response.status, response.statusText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Course API response:', data);
            console.log('📚 Found', data.data?.courses?.length || 0, 'courses');
            return data;
        } catch (error) {
            console.error('❌ AdminAPIService.getAllCourses failed:', error);
            throw error;
        }
    }

    static async createCourse(formData) {
        try {
            const response = await this.authFetch(`${API_BASE}/courses`, {
                method: 'POST',
                body: formData // Don't set Content-Type for FormData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Create course failed:', error);
            throw error;
        }
    }

    static async updateCourse(id, formData) {
        try {
            const response = await this.authFetch(`${API_BASE}/courses/${id}`, {
                method: 'PUT',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Update course failed:', error);
            throw error;
        }
    }

    static async deleteCourse(id) {
        try {
            const response = await this.authFetch(`${API_BASE}/courses/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Delete course failed:', error);
            throw error;
        }
    }

    static async getAllCourses(params = {}) {
        return this.request(`/courses?${new URLSearchParams({
            ...params,
            includeUnpublished: true,
            limit: 100
        }).toString()}`);
    }

    static async getAdminStats() {
        return this.request('/courses/stats');
    }

    // Lesson Management API methods
    static async getAllLessons(params = {}) {
        try {
            const query = new URLSearchParams(params).toString();
            const response = await authManager.apiRequest(`/api/lessons${query ? '?' + query : ''}`);
            return await response.json();
        } catch (error) {
            console.error('Get lessons failed:', error);
            throw error;
        }
    }

    static async getLessonsByCourse(courseId) {
        try {
            const response = await authManager.apiRequest(`/api/lessons/course/${courseId}`);
            return await response.json();
        } catch (error) {
            console.error('Get lessons by course failed:', error);
            throw error;
        }
    }

    static async createLesson(lessonData) {
        try {
            const response = await authManager.apiRequest('/api/lessons', {
                method: 'POST',
                body: JSON.stringify(lessonData)
            });
            return await response.json();
        } catch (error) {
            console.error('Create lesson failed:', error);
            throw error;
        }
    }

    static async updateLesson(id, lessonData) {
        try {
            const response = await authManager.apiRequest(`/api/lessons/${id}`, {
                method: 'PUT',
                body: JSON.stringify(lessonData)
            });
            return await response.json();
        } catch (error) {
            console.error('Update lesson failed:', error);
            throw error;
        }
    }

    static async deleteLesson(id) {
        try {
            const response = await authManager.apiRequest(`/api/lessons/${id}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('Delete lesson failed:', error);
            throw error;
        }
    }

    // User Management API methods
    static async getAllUsers(params = {}) {
        try {
            const response = await authManager.apiRequest(`/api/auth/users?${new URLSearchParams(params)}`);
            return await response.json();
        } catch (error) {
            console.error('Get users failed:', error);
            throw error;
        }
    }

    static async updateUserRole(userId, role) {
        try {
            const response = await authManager.apiRequest(`/api/auth/users/${userId}/role`, {
                method: 'PUT',
                body: JSON.stringify({ role })
            });
            return await response.json();
        } catch (error) {
            console.error('Update user role failed:', error);
            throw error;
        }
    }

    static async toggleUserStatus(userId) {
        try {
            const response = await authManager.apiRequest(`/api/auth/users/${userId}/toggle-status`, {
                method: 'PUT'
            });
            return await response.json();
        } catch (error) {
            console.error('Toggle user status failed:', error);
            throw error;
        }
    }
}

// Admin Course Manager
class AdminCourseManager {
    static async loadAdminStats() {
        try {
            const response = await AdminAPIService.getAdminStats();
            if (response.success) {
                const stats = response.data.overview;
                this.updateStatCard('totalCoursesAdmin', stats.totalCourses || 0);
                this.updateStatCard('totalStudentsAdmin', stats.totalStudents || 0);
                this.updateStatCard('publishedCourses', stats.publishedCourses || 0);
                this.updateStatCard('draftCourses', stats.draftCourses || 0);
            }
        } catch (error) {
            console.error('Error loading admin stats:', error);
        }
    }

    static updateStatCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            this.animateNumber(element, value);
        }
    }

    static animateNumber(element, target) {
        const start = 0;
        const duration = 1500;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.floor(start + (target - start) * progress);
            element.textContent = current.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    static async loadAllCourses() {
        try {
            this.showLoading(true);
            const response = await AdminAPIService.getAllCourses();
            
            if (response.success) {
                AdminState.courses = response.data.courses || [];
                this.renderCoursesTable();
                this.renderRecentCourses();
            } else {
                this.showAlert('coursesAlert', 'error', 'Không thể tải danh sách khóa học');
            }
        } catch (error) {
            console.error('Error loading courses:', error);
            this.showAlert('coursesAlert', 'error', 'Có lỗi xảy ra khi tải khóa học');
        } finally {
            this.showLoading(false);
        }
    }

    static renderCoursesTable() {
        const tbody = document.getElementById('coursesTableBody');
        if (!tbody) return;

        if (AdminState.courses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 3rem;">
                        <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                        <p style="color: var(--text-secondary); font-size: 1.125rem;">Chưa có khóa học nào</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = AdminState.courses.map(course => `
            <tr>
                <td>
                    ${course.image ? 
                        `<img src="${course.image}" alt="${course.name}" class="course-image-small" onerror="this.style.display='none'">` :
                        `<div style="width: 60px; height: 40px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white;">
                            <i class="fas fa-image"></i>
                         </div>`
                    }
                </td>
                <td>
                    <strong>${course.name}</strong>
                    <br>
                    <small style="color: var(--text-secondary);">${course.instructor}</small>
                </td>
                <td><span class="course-category-badge">${course.category}</span></td>
                <td>${course.price ? course.price.toLocaleString('vi-VN') + ' VND' : 'Miễn phí'}</td>
                <td>${course.studentsCount || 0}</td>
                <td>
                    <span class="course-status ${course.published ? 'published' : 'draft'}">
                        ${course.published ? 'Đã xuất bản' : 'Bản nháp'}
                    </span>
                </td>
                <td>
                    <div class="course-actions">
                        <button class="btn btn-small btn-view" onclick="viewCourse('${course._id}')" title="Xem chi tiết">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-small btn-edit" onclick="editCourse('${course._id}')" title="Chỉnh sửa">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-small btn-delete" onclick="deleteCourse('${course._id}', '${course.name}')" title="Xóa">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    static renderRecentCourses() {
        const container = document.getElementById('recentCourses');
        if (!container) return;

        const recentCourses = AdminState.courses
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        if (recentCourses.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Chưa có khóa học nào</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="courses-table">
                <thead>
                    <tr>
                        <th>Tên khóa học</th>
                        <th>Danh mục</th>
                        <th>Ngày tạo</th>
                        <th>Trạng thái</th>
                        <th>Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentCourses.map(course => `
                        <tr>
                            <td><strong>${course.name}</strong></td>
                            <td>${course.category}</td>
                            <td>${new Date(course.createdAt).toLocaleDateString('vi-VN')}</td>
                            <td>
                                <span class="course-status ${course.published ? 'published' : 'draft'}">
                                    ${course.published ? 'Đã xuất bản' : 'Bản nháp'}
                                </span>
                            </td>
                            <td>
                                <div class="course-actions">
                                    <button class="btn btn-small btn-view" onclick="viewCourse('${course._id}')">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-small btn-edit" onclick="editCourse('${course._id}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    static async createCourse(formData) {
        try {
            this.showLoading(true);
            
            const response = await AdminAPIService.createCourse(formData);
            
            if (response.success) {
                this.showAlert('addCourseAlert', 'success', 'Tạo khóa học thành công!');
                resetCourseForm();
                await this.loadAllCourses();
                await this.loadAdminStats();
                
                // Switch to courses tab
                switchSection('courses');
            } else {
                this.showAlert('addCourseAlert', 'error', response.message || 'Có lỗi xảy ra khi tạo khóa học');
            }
        } catch (error) {
            console.error('Error creating course:', error);
            this.showAlert('addCourseAlert', 'error', error.message || 'Có lỗi xảy ra khi tạo khóa học');
        } finally {
            this.showLoading(false);
        }
    }

    static async updateCourse(id, formData) {
        try {
            this.showLoading(true);
            
            const response = await AdminAPIService.updateCourse(id, formData);
            
            if (response.success) {
                this.showAlert('coursesAlert', 'success', 'Cập nhật khóa học thành công!');
                closeEditModal();
                await this.loadAllCourses();
                await this.loadAdminStats();
            } else {
                this.showAlert('coursesAlert', 'error', response.message || 'Có lỗi xảy ra khi cập nhật khóa học');
            }
        } catch (error) {
            console.error('Error updating course:', error);
            this.showAlert('coursesAlert', 'error', error.message || 'Có lỗi xảy ra khi cập nhật khóa học');
        } finally {
            this.showLoading(false);
        }
    }

    static async deleteCourseById(id) {
        try {
            this.showLoading(true);
            
            const response = await AdminAPIService.deleteCourse(id);
            
            if (response.success) {
                this.showAlert('coursesAlert', 'success', 'Xóa khóa học thành công!');
                await this.loadAllCourses();
                await this.loadAdminStats();
            } else {
                this.showAlert('coursesAlert', 'error', response.message || 'Có lỗi xảy ra khi xóa khóa học');
            }
        } catch (error) {
            console.error('Error deleting course:', error);
            this.showAlert('coursesAlert', 'error', error.message || 'Có lỗi xảy ra khi xóa khóa học');
        } finally {
            this.showLoading(false);
        }
    }

    static showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        }
    }

    static showAlert(containerId, type, message) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.className = `alert ${type}`;
        container.textContent = message;
        container.style.display = 'block';

        // Auto hide after 5 seconds
        setTimeout(() => {
            container.style.display = 'none';
        }, 5000);
    }
}

// User Management
class AdminUserManager {
    static async loadUsers(params = {}) {
        try {
            this.showLoading(true);
            const defaultParams = {
                page: AdminState.userPagination.currentPage,
                limit: AdminState.userPagination.limit
            };
            
            const response = await AdminAPIService.getAllUsers({ ...defaultParams, ...params });
            
            if (response.success) {
                AdminState.users = response.data.users;
                AdminState.userPagination = {
                    currentPage: response.data.currentPage,
                    totalPages: response.data.totalPages,
                    limit: AdminState.userPagination.limit
                };
                
                this.renderUsersTable();
                this.updateUsersPagination();
                this.loadUserStats();
            } else {
                this.showAlert('usersAlert', 'error', response.message || 'Không thể tải danh sách người dùng');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.showAlert('usersAlert', 'error', 'Có lỗi xảy ra khi tải danh sách người dùng');
        } finally {
            this.showLoading(false);
        }
    }

    static async loadUserStats() {
        try {
            // Count users by role from current users data
            const stats = AdminState.users.reduce((acc, user) => {
                acc.total++;
                acc[user.role] = (acc[user.role] || 0) + 1;
                return acc;
            }, { total: 0, user: 0, teacher: 0, admin: 0 });

            this.updateStatCard('totalUsers', stats.total);
            this.updateStatCard('totalStudents', stats.user);
            this.updateStatCard('totalTeachers', stats.teacher);
            this.updateStatCard('totalAdmins', stats.admin);
        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    }

    static renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        if (AdminState.users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 3rem;">
                        <i class="fas fa-users" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                        <p style="color: var(--text-secondary); font-size: 1.125rem;">Không có người dùng nào</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = AdminState.users.map(user => `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                        <div class="user-details">
                            <div class="user-name">${user.name}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="user-email">${user.email}</div>
                </td>
                <td>
                    <span class="role-badge role-${user.role}">
                        ${this.getRoleText(user.role)}
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${user.isActive ? 'active' : 'inactive'}">
                        ${user.isActive ? 'Hoạt động' : 'Bị khóa'}
                    </span>
                </td>
                <td>${this.formatDate(user.createdAt)}</td>
                <td>${user.lastLogin ? this.formatDate(user.lastLogin) : 'Chưa đăng nhập'}</td>
                <td>
                    <div class="user-actions">
                        <select onchange="AdminUserManager.changeUserRole('${user._id}', this.value)" class="btn-small">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>Học viên</option>
                            <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Giáo viên</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        <button class="btn btn-small ${user.isActive ? 'btn-secondary' : 'btn-primary'}" 
                                onclick="AdminUserManager.toggleUserStatus('${user._id}')">
                            ${user.isActive ? 'Khóa' : 'Mở khóa'}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    static async changeUserRole(userId, newRole) {
        try {
            const response = await AdminAPIService.updateUserRole(userId, newRole);
            if (response.success) {
                this.showAlert('usersAlert', 'success', 'Cập nhật vai trò thành công');
                this.loadUsers(); // Reload users
            } else {
                this.showAlert('usersAlert', 'error', response.message || 'Không thể cập nhật vai trò');
            }
        } catch (error) {
            console.error('Error changing user role:', error);
            this.showAlert('usersAlert', 'error', 'Có lỗi xảy ra khi cập nhật vai trò');
        }
    }

    static async toggleUserStatus(userId) {
        try {
            const response = await AdminAPIService.toggleUserStatus(userId);
            if (response.success) {
                const action = response.data.user.isActive ? 'mở khóa' : 'khóa';
                this.showAlert('usersAlert', 'success', `${action} tài khoản thành công`);
                this.loadUsers(); // Reload users
            } else {
                this.showAlert('usersAlert', 'error', response.message || 'Không thể thay đổi trạng thái');
            }
        } catch (error) {
            console.error('Error toggling user status:', error);
            this.showAlert('usersAlert', 'error', 'Có lỗi xảy ra khi thay đổi trạng thái');
        }
    }

    static updateUsersPagination() {
        const pageInfo = document.getElementById('pageInfoUsers');
        const prevBtn = document.getElementById('prevPageUsers');
        const nextBtn = document.getElementById('nextPageUsers');

        if (pageInfo) {
            pageInfo.textContent = `Trang ${AdminState.userPagination.currentPage} của ${AdminState.userPagination.totalPages}`;
        }

        if (prevBtn) {
            prevBtn.disabled = AdminState.userPagination.currentPage <= 1;
            prevBtn.onclick = () => this.changePage(AdminState.userPagination.currentPage - 1);
        }

        if (nextBtn) {
            nextBtn.disabled = AdminState.userPagination.currentPage >= AdminState.userPagination.totalPages;
            nextBtn.onclick = () => this.changePage(AdminState.userPagination.currentPage + 1);
        }
    }

    static changePage(page) {
        AdminState.userPagination.currentPage = page;
        this.loadUsers();
    }

    static setupUserFilters() {
        const searchInput = document.getElementById('userSearch');
        const roleFilter = document.getElementById('roleFilter');
        const statusFilter = document.getElementById('statusFilter');

        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterUsers();
                }, 500);
            });
        }

        if (roleFilter) {
            roleFilter.addEventListener('change', () => this.filterUsers());
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterUsers());
        }
    }

    static filterUsers() {
        const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
        const roleFilter = document.getElementById('roleFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';

        const params = {};
        if (roleFilter) params.role = roleFilter;
        if (statusFilter) params.isActive = statusFilter;

        // Reset to page 1 when filtering
        AdminState.userPagination.currentPage = 1;
        this.loadUsers(params);
    }

    static getRoleText(role) {
        const roleTexts = {
            'admin': 'Quản trị viên',
            'teacher': 'Giáo viên',
            'user': 'Học viên'
        };
        return roleTexts[role] || role;
    }

    static formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static updateStatCard(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    static showAlert(containerId, type, message) {
        // Reuse AdminCourseManager's alert function or implement similar
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${type}`;
        alertDiv.textContent = message;
        alertDiv.style.display = 'block';
        
        const container = document.getElementById(containerId) || document.querySelector('#users .section-header');
        if (container) {
            // Remove existing alerts
            const existingAlerts = container.querySelectorAll('.alert');
            existingAlerts.forEach(alert => alert.remove());
            
            container.appendChild(alertDiv);
            
            setTimeout(() => {
                alertDiv.remove();
            }, 5000);
        }
    }

    static showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }
}

// Navigation Management
class AdminNavigation {
    static init() {
        const navItems = document.querySelectorAll('.admin-nav-item[data-section]');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.switchSection(section);
            });
        });
    }

    static switchSection(sectionId) {
        console.log('🔄 AdminNavigation.switchSection:', sectionId);
        showSection(sectionId);
    }
}

// Form Management
class AdminFormManager {
    static init() {
        this.setupCourseForm();
        this.setupFileUploads();
        this.setupTagsInput();
    }

    static setupCourseForm() {
        const form = document.getElementById('courseForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCourseSubmit(form);
            });
        }

        const editForm = document.getElementById('editCourseForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleEditSubmit(editForm);
            });
        }

        // Add lesson form event listener (both old and new forms)
        const lessonForm = document.getElementById('lessonForm');
        if (lessonForm) {
            lessonForm.addEventListener('submit', handleAddLessonSubmit);
        }

        const newLessonForm = document.getElementById('newLessonForm');
        if (newLessonForm) {
            newLessonForm.addEventListener('submit', handleNewLessonSubmit);
        }
    }

    static async handleCourseSubmit(form) {
        const formData = new FormData(form);
        
        // Add tags
        formData.set('tags', JSON.stringify(AdminState.tags));
        
        // Validate required fields
        const requiredFields = ['name', 'category', 'level', 'instructor', 'description'];
        const missingFields = requiredFields.filter(field => !formData.get(field));
        
        if (missingFields.length > 0) {
            AdminCourseManager.showAlert('addCourseAlert', 'error', 
                `Vui lòng điền đầy đủ thông tin: ${missingFields.join(', ')}`);
            return;
        }

        await AdminCourseManager.createCourse(formData);
    }

    static async handleEditSubmit(form) {
        const formData = new FormData(form);
        
        // Add tags
        formData.set('tags', JSON.stringify(AdminState.tags));
        
        await AdminCourseManager.updateCourse(AdminState.currentEditId, formData);
    }

    static setupFileUploads() {
        // Image upload
        const imageInput = document.getElementById('courseImage');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                this.handleFilePreview(e.target, 'imagePreview', 'image');
            });
        }

        // Video upload
        const videoInput = document.getElementById('courseVideo');
        if (videoInput) {
            videoInput.addEventListener('change', (e) => {
                this.handleFilePreview(e.target, 'videoPreview', 'video');
            });
        }
    }

    static handleFilePreview(input, previewId, type) {
        const preview = document.getElementById(previewId);
        if (!preview) return;

        preview.innerHTML = '';

        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'file-preview-item';

                if (type === 'image') {
                    previewItem.innerHTML = `
                        <img src="${e.target.result}" alt="Preview">
                        <button type="button" class="file-preview-remove" onclick="removeFilePreview('${input.id}', '${previewId}')">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                } else if (type === 'video') {
                    previewItem.innerHTML = `
                        <video controls>
                            <source src="${e.target.result}" type="${file.type}">
                        </video>
                        <button type="button" class="file-preview-remove" onclick="removeFilePreview('${input.id}', '${previewId}')">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                }

                preview.appendChild(previewItem);
            };

            reader.readAsDataURL(file);
        }
    }

    static setupTagsInput() {
        const tagsInput = document.getElementById('tagsInput');
        const tagInput = tagsInput?.querySelector('.tag-input');
        
        if (tagInput) {
            tagInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    e.preventDefault();
                    this.addTag(e.target.value.trim());
                    e.target.value = '';
                }
            });

            tagInput.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && AdminState.tags.length > 0) {
                    this.removeTag(AdminState.tags.length - 1);
                }
            });
        }
    }

    static addTag(tagText) {
        if (!AdminState.tags.includes(tagText)) {
            AdminState.tags.push(tagText);
            this.renderTags();
        }
    }

    static removeTag(index) {
        AdminState.tags.splice(index, 1);
        this.renderTags();
    }

    static renderTags() {
        const tagsInput = document.getElementById('tagsInput');
        const tagInput = tagsInput?.querySelector('.tag-input');
        
        if (!tagsInput || !tagInput) return;

        // Remove existing tags
        tagsInput.querySelectorAll('.tag-item').forEach(tag => tag.remove());

        // Add tags before input
        AdminState.tags.forEach((tag, index) => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-item';
            tagElement.innerHTML = `
                <span>${tag}</span>
                <button type="button" class="tag-remove" onclick="removeTagByIndex(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            tagsInput.insertBefore(tagElement, tagInput);
        });

        // Update hidden input
        const hiddenInput = document.getElementById('courseTags');
        if (hiddenInput) {
            hiddenInput.value = JSON.stringify(AdminState.tags);
        }
    }
}

// Global Functions
function switchSection(sectionId) {
    AdminNavigation.switchSection(sectionId);
}

function openAddCourseModal() {
    switchSection('add-course');
}

function refreshCoursesList() {
    AdminCourseManager.loadAllCourses();
}

function resetCourseForm() {
    const form = document.getElementById('courseForm');
    if (form) {
        form.reset();
        AdminState.tags = [];
        AdminFormManager.renderTags();
        
        // Clear file previews
        document.getElementById('imagePreview').innerHTML = '';
        document.getElementById('videoPreview').innerHTML = '';
    }
}

function removeFilePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    
    if (input) input.value = '';
    if (preview) preview.innerHTML = '';
}

function removeTagByIndex(index) {
    AdminFormManager.removeTag(index);
}

async function viewCourse(courseId) {
    try {
        const response = await APIService.getCourse(courseId);
        if (response.success) {
            // Open course in new tab
            window.open(`/?course=${courseId}`, '_blank');
        }
    } catch (error) {
        console.error('Error viewing course:', error);
    }
}

async function editCourse(courseId) {
    try {
        const response = await APIService.getCourse(courseId);
        if (response.success) {
            AdminState.currentEditId = courseId;
            populateEditForm(response.data);
            document.getElementById('editCourseModal').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading course for edit:', error);
        AdminCourseManager.showAlert('coursesAlert', 'error', 'Không thể tải thông tin khóa học');
    }
}

function populateEditForm(course) {
    const form = document.getElementById('editCourseForm');
    
    form.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label for="editName">Tên khóa học *</label>
                <input type="text" id="editName" name="name" value="${course.name}" required>
            </div>
            <div class="form-group">
                <label for="editCategory">Danh mục *</label>
                <select id="editCategory" name="category" required>
                    <option value="Programming" ${course.category === 'Programming' ? 'selected' : ''}>Lập trình</option>
                    <option value="Design" ${course.category === 'Design' ? 'selected' : ''}>Thiết kế</option>
                    <option value="Business" ${course.category === 'Business' ? 'selected' : ''}>Kinh doanh</option>
                    <option value="Marketing" ${course.category === 'Marketing' ? 'selected' : ''}>Marketing</option>
                    <option value="Photography" ${course.category === 'Photography' ? 'selected' : ''}>Nhiếp ảnh</option>
                    <option value="Music" ${course.category === 'Music' ? 'selected' : ''}>Âm nhạc</option>
                    <option value="Language" ${course.category === 'Language' ? 'selected' : ''}>Ngôn ngữ</option>
                    <option value="Fitness" ${course.category === 'Fitness' ? 'selected' : ''}>Thể dục</option>
                    <option value="Cooking" ${course.category === 'Cooking' ? 'selected' : ''}>Nấu ăn</option>
                    <option value="Other" ${course.category === 'Other' ? 'selected' : ''}>Khác</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editPrice">Giá (VND)</label>
                <input type="number" id="editPrice" name="price" value="${course.price || ''}" min="0" step="1000">
            </div>
            <div class="form-group">
                <label for="editDuration">Thời lượng (phút)</label>
                <input type="number" id="editDuration" name="duration" value="${course.duration || ''}" min="1">
            </div>
            <div class="form-group">
                <label for="editLevel">Cấp độ *</label>
                <select id="editLevel" name="level" required>
                    <option value="Beginner" ${course.level === 'Beginner' ? 'selected' : ''}>Cơ bản</option>
                    <option value="Intermediate" ${course.level === 'Intermediate' ? 'selected' : ''}>Trung bình</option>
                    <option value="Advanced" ${course.level === 'Advanced' ? 'selected' : ''}>Nâng cao</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editInstructor">Giảng viên *</label>
                <input type="text" id="editInstructor" name="instructor" value="${course.instructor}" required>
            </div>
        </div>
        <div class="form-group">
            <label for="editDescription">Mô tả khóa học *</label>
            <textarea id="editDescription" name="description" required rows="4">${course.description}</textarea>
        </div>
        <div class="form-group">
            <label>
                <input type="checkbox" name="published" ${course.published ? 'checked' : ''}> 
                Xuất bản khóa học
            </label>
        </div>
    `;

    // Set tags for editing
    AdminState.tags = course.tags || [];
}

function deleteCourse(courseId, courseName) {
    AdminState.currentDeleteId = courseId;
    document.getElementById('deleteCourseName').textContent = courseName;
    document.getElementById('deleteModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editCourseModal').style.display = 'none';
    AdminState.currentEditId = null;
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    AdminState.currentDeleteId = null;
}

async function confirmDelete() {
    if (AdminState.currentDeleteId) {
        await AdminCourseManager.deleteCourseById(AdminState.currentDeleteId);
        closeDeleteModal();
    }
}

// Initialize Admin Application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔧 Admin Dashboard Initialized');
    
    // Only run admin logic if we're on admin page
    if (!window.location.pathname.includes('admin.html')) {
        console.log('🔧 Not on admin page, skipping admin initialization');
        return;
    }
    
    // Check authentication and permissions
    const hasAccess = await authManager.requireTeacherOrAdmin();
    if (!hasAccess) {
        return;
    }
    
    // Wait for auth manager to initialize
    await new Promise(resolve => {
        if (authManager.isAuthenticated()) {
            resolve();
        } else {
            setTimeout(resolve, 1000);
        }
    });
    
    // Show/hide admin-only sections
    const isAdmin = authManager.hasRole('admin');
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    
    // Add lesson management navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            
            // Handle lesson section
            if (target === 'lessons') {
                console.log('Loading lessons section...');
                console.log('Calling loadCoursesForSelect...');
                await AdminLessonManager.loadCoursesForSelect();
                console.log('Calling loadLessons...');
                await AdminLessonManager.loadLessons();
            }
            
            // Handle add lesson section
            if (target === 'add-lesson') {
                console.log('Loading add-lesson section...');
                console.log('Auto-loading courses for new form...');
                
                // Load courses for both old and new forms
                setTimeout(async () => {
                    console.log('🔄 Loading courses for add-lesson section...');
                    
                    // Try new form first
                    if (document.getElementById('courseSelect')) {
                        console.log('📝 Using new form - calling loadCoursesForNewForm()');
                        loadCoursesForNewForm();
                    }
                    
                    // Also try old form in case it exists
                    if (document.getElementById('lessonCourseId')) {
                        console.log('📝 Using old form - calling AdminLessonManager.loadCoursesForSelect()');
                        await AdminLessonManager.loadCoursesForSelect();
                    }
                }, 300);
            }
            
            // Show selected section
            showSection(target);
        });
    });
    
    // Load courses first for all sections that need them
    console.log('🔄 Loading courses for dropdowns...');
    await AdminLessonManager.loadCoursesForSelect();
    
    // Initialize based on hash or default
    const hash = window.location.hash.replace('#', '');
    if (hash === 'lessons') {
        await AdminLessonManager.loadLessons();
        showSection('lessons');
    } else if (hash === 'add-lesson') {
        showSection('add-lesson');
    } else {
        // Show default section (dashboard)
        showSection('dashboard');
    }
    adminOnlyElements.forEach(element => {
        element.style.display = isAdmin ? 'block' : 'none';
    });
    
    // Initialize managers
    AdminNavigation.init();
    AdminFormManager.init();
    
    // Load initial data
    AdminCourseManager.loadAdminStats();
    AdminCourseManager.loadAllCourses();
    
    // Initialize user management if admin
    if (isAdmin) {
        AdminUserManager.setupUserFilters();
        AdminUserManager.loadUsers();
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        const editModal = document.getElementById('editCourseModal');
        const deleteModal = document.getElementById('deleteModal');
        
        if (e.target === editModal) {
            closeEditModal();
        }
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });
    
    // Initialize Messenger when section is activated
    const messengerNav = document.querySelector('[data-section="messenger"]');
    if (messengerNav) {
        messengerNav.addEventListener('click', () => {
            console.log('Messenger section clicked, loading conversations...');
            // Load conversations whenever messenger tab is clicked
            setTimeout(() => {
                AdminMessenger.loadConversations();
            }, 100);
        });
    }
    
    // Auto-refresh conversations every 10 seconds if messenger is active
    setInterval(() => {
        const messengerSection = document.getElementById('messenger');
        if (messengerSection && messengerSection.classList.contains('active')) {
            console.log('Auto-refreshing conversations...');
            AdminMessenger.loadConversations();
        }
    }, 10000);
});

// Admin Messenger Manager
const AdminMessenger = {
    currentConversation: null,
    conversations: [],
    messages: [],
    
    async loadConversations() {
        try {
            const token = localStorage.getItem('token');
            console.log('Loading conversations...');
            console.log('Token:', token ? 'exists' : 'missing');
            
            const response = await fetch('/api/chat/conversations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            const result = await response.json();
            console.log('Conversations result:', result);
            console.log('Result structure:', {
                success: result.success,
                hasData: !!result.data,
                dataKeys: result.data ? Object.keys(result.data) : [],
                conversationsType: result.data?.conversations ? typeof result.data.conversations : 'undefined',
                conversationsLength: Array.isArray(result.data?.conversations) ? result.data.conversations.length : 'not array'
            });
            
            if (result.success) {
                // Kiểm tra cả trong result.data.conversations và result.data
                this.conversations = result.data.conversations || result.data || [];
                console.log('Loaded conversations:', this.conversations);
                console.log('Number of conversations:', this.conversations.length);
                if (this.conversations.length > 0) {
                    console.log('First conversation:', this.conversations[0]);
                }
                this.renderConversations();
            } else {
                console.error('API error:', result.message);
                this.showError('Không thể tải danh sách cuộc trò chuyện: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            this.showError('Có lỗi xảy ra khi tải dữ liệu');
        }
    },
    
    renderConversations() {
        const container = document.getElementById('conversationsList');
        if (!container) {
            console.error('conversationsList container not found');
            return;
        }
        
        console.log('Rendering conversations:', this.conversations.length, 'items');
        
        if (!Array.isArray(this.conversations) || this.conversations.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                    <p>Chưa có tin nhắn nào</p>
                    <button onclick="AdminMessenger.loadConversations()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                        <i class="fas fa-refresh"></i> Tải lại
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.conversations.map(conv => {
            const partner = conv.partner;
            if (!partner) {
                console.warn('Conversation without partner:', conv);
                return ''; // Skip conversations without partner
            }
            
            const lastMsg = conv.lastMessage;
            const initials = partner.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            const time = lastMsg ? this.formatTime(lastMsg.createdAt) : '';
            const preview = lastMsg ? (lastMsg.content.substring(0, 50) + (lastMsg.content.length > 50 ? '...' : '')) : 'Chưa có tin nhắn';
            const unread = conv.unreadCount || 0;
            
            return `
                <div class="conversation-item" onclick="AdminMessenger.openConversation('${conv._id}')" style="padding: 1rem; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s; ${this.currentConversation?._id === conv._id ? 'background: var(--bg-secondary);' : ''}">
                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0;">
                            ${initials}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <div style="font-weight: 600; font-size: 0.9375rem;">${this.escapeHtml(partner.name)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary);">${time}</div>
                            </div>
                            <div style="font-size: 0.875rem; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${this.escapeHtml(preview)}
                            </div>
                        </div>
                        ${unread > 0 ? `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--error-color); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;">${unread}</div>` : ''}
                    </div>
                </div>
            `;
        }).filter(html => html !== '').join('');
        
        // If no valid conversations after filtering
        if (container.innerHTML.trim() === '') {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                    <p>Chưa có tin nhắn hợp lệ</p>
                    <button onclick="AdminMessenger.loadConversations()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                        <i class="fas fa-refresh"></i> Tải lại
                    </button>
                </div>
            `;
        }
    },
    
    async openConversation(conversationId) {
        try {
            const conv = this.conversations.find(c => c._id === conversationId);
            if (!conv) return;
            
            this.currentConversation = conv;
            this.renderConversations(); // Re-render to highlight
            
            // Update header
            const header = document.getElementById('chatHeader');
            const partner = conv.partner;
            const initials = partner.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            
            header.innerHTML = `
                <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">
                    ${initials}
                </div>
                <div>
                    <div style="font-weight: 600; font-size: 1.125rem;">${partner.name}</div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">${partner.email}</div>
                </div>
            `;
            
            // Load messages
            await this.loadMessages(conversationId);
            
            // Show input
            document.getElementById('chatInput').style.display = 'block';
            
        } catch (error) {
            console.error('Error opening conversation:', error);
        }
    },
    
    async loadMessages(conversationId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/chat/conversations/${conversationId}/messages?page=1&limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.messages = result.data.messages.reverse();
                this.renderMessages();
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    },
    
    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        const user = authManager.getCurrentUser();
        
        container.innerHTML = this.messages.map(msg => {
            const isOutgoing = msg.sender._id === user._id;
            const time = this.formatTime(msg.createdAt);
            
            return `
                <div style="margin-bottom: 1.5rem; display: flex; ${isOutgoing ? 'justify-content: flex-end' : 'justify-content: flex-start'};">
                    <div style="max-width: 70%;">
                        ${!isOutgoing ? `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${msg.sender.name}</div>` : ''}
                        <div style="padding: 0.75rem 1rem; border-radius: ${isOutgoing ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0'}; background: ${isOutgoing ? 'var(--primary-color)' : 'var(--bg-secondary)'}; color: ${isOutgoing ? 'white' : 'var(--text-primary)'}; word-wrap: break-word;">
                            ${this.escapeHtml(msg.content)}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; text-align: ${isOutgoing ? 'right' : 'left'};">
                            ${time}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.scrollTop = container.scrollHeight;
    },
    
    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Hôm qua';
        } else if (diffDays < 7) {
            return diffDays + ' ngày trước';
        } else {
            return date.toLocaleDateString('vi-VN');
        }
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    showError(message) {
        const container = document.getElementById('conversationsList');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--error-color);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p style="margin-bottom: 1rem;">${message}</p>
                    <button onclick="AdminMessenger.loadConversations()" style="padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-refresh"></i> Thử lại
                    </button>
                </div>
            `;
        }
    }
};

// Send message function
async function sendTeacherMessage() {
    if (!AdminMessenger.currentConversation) return;
    
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/chat/conversations/${AdminMessenger.currentConversation._id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });
        
        const result = await response.json();
        console.log('Send message result:', result);
        
        if (result.success) {
            input.value = '';
            
            // Thêm tin nhắn mới vào danh sách ngay lập tức
            const newMessage = result.data;
            console.log('New message:', newMessage);
            
            // Thêm vào array
            AdminMessenger.messages.push(newMessage);
            
            // Thêm trực tiếp vào DOM thay vì render lại toàn bộ
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                const user = authManager.getCurrentUser();
                const isOutgoing = newMessage.sender._id === user._id;
                const time = AdminMessenger.formatTime(newMessage.createdAt);
                
                const messageHTML = `
                    <div style="margin-bottom: 1.5rem; display: flex; ${isOutgoing ? 'justify-content: flex-end' : 'justify-content: flex-start'};">
                        <div style="max-width: 70%;">
                            ${!isOutgoing ? `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${newMessage.sender.name}</div>` : ''}
                            <div style="padding: 0.75rem 1rem; border-radius: ${isOutgoing ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0'}; background: ${isOutgoing ? 'var(--primary-color)' : 'var(--bg-secondary)'}; color: ${isOutgoing ? 'white' : 'var(--text-primary)'}; word-wrap: break-word;">
                                ${AdminMessenger.escapeHtml(newMessage.content)}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; text-align: ${isOutgoing ? 'right' : 'left'};">
                                ${time}
                            </div>
                        </div>
                    </div>
                `;
                
                messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            
            // Cập nhật lastMessage trong conversation list
            const convIndex = AdminMessenger.conversations.findIndex(c => c._id === AdminMessenger.currentConversation._id);
            if (convIndex !== -1) {
                AdminMessenger.conversations[convIndex].lastMessage = newMessage;
                AdminMessenger.conversations[convIndex].lastActivity = newMessage.createdAt;
                // Di chuyển conversation lên đầu
                const [conv] = AdminMessenger.conversations.splice(convIndex, 1);
                AdminMessenger.conversations.unshift(conv);
                AdminMessenger.renderConversations();
            }
        } else {
            alert('Không thể gửi tin nhắn: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Có lỗi xảy ra khi gửi tin nhắn');
    }
}

// Section Navigation Function
function showSection(sectionName) {
    console.log('🔧 Showing section:', sectionName);
    
    // Hide all sections
    const sections = document.querySelectorAll('.admin-section');
    sections.forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
        console.log('✅ Section shown:', sectionName);
        
        // Auto-load lessons when showing lessons section
        if (sectionName === 'lessons') {
            console.log('🔄 Auto-loading lessons...');
            setTimeout(() => AdminLessonManager.loadLessons(), 100);
        }
    } else {
        console.error('❌ Section not found:', sectionName);
    }
    
    // Update navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-target') === sectionName) {
            item.classList.add('active');
        }
    });
    
    // Update URL hash
    window.location.hash = sectionName;
}

// ====== LESSON MANAGEMENT ======

const AdminLessonState = {
    lessons: [],
    currentEditId: null,
    currentDeleteId: null,
    selectedCourseId: null,
    isLoading: false
};

class AdminLessonManager {
    static async loadLessons(courseId = null) {
        try {
            this.showLoading(true);
            
            let response;
            if (courseId) {
                response = await AdminAPIService.getLessonsByCourse(courseId);
                AdminLessonState.selectedCourseId = courseId;
            } else {
                response = await AdminAPIService.getAllLessons();
                AdminLessonState.selectedCourseId = null;
            }
            
            if (response.success) {
                // Xử lý cả trường hợp API trả về array trực tiếp hoặc object chứa lessons
                const lessons = response.data.lessons || response.data;
                AdminLessonState.lessons = Array.isArray(lessons) ? lessons : [];
                this.renderLessonsTable();
            } else {
                this.showAlert('lessonsAlert', 'error', 'Không thể tải danh sách bài học');
            }
        } catch (error) {
            console.error('Error loading lessons:', error);
            this.showAlert('lessonsAlert', 'error', 'Có lỗi xảy ra khi tải bài học');
        } finally {
            this.showLoading(false);
        }
    }

    static renderLessonsTable() {
        const tbody = document.getElementById('lessonsTableBody');
        if (!tbody) return;

        if (AdminLessonState.lessons.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 3rem;">
                        <i class="fas fa-book-open" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                        <p style="color: var(--text-secondary); font-size: 1.125rem;">Chưa có bài học nào</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = AdminLessonState.lessons.map(lesson => `
            <tr>
                <td>
                    <span class="lesson-order">${lesson.order || 1}</span>
                </td>
                <td>
                    <strong>${lesson.title}</strong>
                    <br>
                    <small style="color: var(--text-secondary);">${lesson.course?.name || 'Unknown Course'}</small>
                </td>
                <td>
                    ${lesson.type === 'video' ? 
                        '<i class="fas fa-play-circle" style="color: #ff4757;"></i> Video' :
                        lesson.type === 'quiz' ?
                        '<i class="fas fa-question-circle" style="color: #3742fa;"></i> Quiz' :
                        '<i class="fas fa-file-text" style="color: #2ed573;"></i> Tài liệu'}
                </td>
                <td>${lesson.duration ? lesson.duration + ' phút' : 'N/A'}</td>
                <td>
                    <span class="lesson-status ${lesson.published ? 'published' : 'draft'}">
                        ${lesson.published ? 'Đã xuất bản' : 'Bản nháp'}
                    </span>
                </td>
                <td>${new Date(lesson.createdAt).toLocaleDateString('vi-VN')}</td>
                <td>
                    <div class="lesson-actions">
                        <button class="btn btn-small btn-view" onclick="viewLesson('${lesson._id}')" title="Xem chi tiết">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-small btn-edit" onclick="editLesson('${lesson._id}')" title="Chỉnh sửa">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-small btn-delete" onclick="deleteLesson('${lesson._id}', '${lesson.title}')" title="Xóa">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    static showLoading(show) {
        const loadingEl = document.getElementById('lessonsLoading');
        if (loadingEl) {
            loadingEl.style.display = show ? 'block' : 'none';
        }
    }

    static showAlert(elementId, type, message) {
        const alertEl = document.getElementById(elementId);
        if (alertEl) {
            alertEl.className = `alert alert-${type}`;
            alertEl.textContent = message;
            alertEl.style.display = 'block';
            setTimeout(() => {
                alertEl.style.display = 'none';
            }, 5000);
        }
    }

    static async createLesson(formData) {
        try {
            this.showLoading(true);
            this.updateVideoProgress(0, 'Đang chuẩn bị...');
            
            const videoFile = formData.get('videoFile');
            const videoUrl = formData.get('videoUrl');
            
            // Kiểm tra có file video để upload không
            if (videoFile && videoFile.size > 0) {
                this.updateVideoProgress(10, 'Đang upload video...');
                
                // Sử dụng formData có sẵn vì đã có video file
                // Đảm bảo có field 'course' cho backend
                if (!formData.get('course')) {
                    formData.append('course', formData.get('courseId'));
                }
                
                // Add quiz data if type is quiz  
                if (formData.get('type') === 'quiz') {
                    formData.append('quiz', JSON.stringify({ questions: [] }));
                }

                const response = await this.createLessonWithUpload(formData);
                
                if (response.success) {
                    this.updateVideoProgress(100, 'Upload hoàn thành!');
                    this.showAlert('lessonsAlert', 'success', 'Tạo bài học với video thành công!');
                    this.loadLessons(AdminLessonState.selectedCourseId);
                    document.getElementById('lessonForm').reset();
                    this.hideVideoProgress();
                    this.toggleAddLessonForm();
                } else {
                    this.hideVideoProgress();
                    this.showAlert('lessonsAlert', 'error', response.message || 'Không thể tạo bài học');
                }
            } else {
                // Tạo bài học không có file video (chỉ có URL)
                const lessonData = {
                    course: formData.get('courseId'),
                    title: formData.get('title'),
                    description: formData.get('description'),
                    type: formData.get('type'),
                    order: parseInt(formData.get('order')) || 1,
                    duration: parseInt(formData.get('duration')) || 0,
                    content: {
                        video: videoUrl || '',
                        code: formData.get('codeExample') || '',
                        documents: formData.get('documents') ? formData.get('documents').split('\n').filter(d => d.trim()) : []
                    },
                    published: formData.get('published') === 'on'
                };

                // Add quiz data if type is quiz
                if (lessonData.type === 'quiz') {
                    lessonData.quiz = {
                        questions: [] // Will be added later through quiz management
                    };
                }

                const response = await AdminAPIService.createLesson(lessonData);
                
                if (response.success) {
                    this.showAlert('lessonsAlert', 'success', 'Tạo bài học thành công!');
                    this.loadLessons(AdminLessonState.selectedCourseId);
                    document.getElementById('lessonForm').reset();
                    this.toggleAddLessonForm();
                } else {
                    this.showAlert('lessonsAlert', 'error', response.message || 'Không thể tạo bài học');
                }
            }
        } catch (error) {
            console.error('Error creating lesson:', error);
            this.hideVideoProgress();
            this.showAlert('lessonsAlert', 'error', 'Có lỗi xảy ra khi tạo bài học');
        } finally {
            this.showLoading(false);
        }
    }

    static async createLessonWithUpload(formData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Upload progress handler
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 90) + 10; // 10-100%
                    this.updateVideoProgress(progress, `Đang upload... ${progress}%`);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200 || xhr.status === 201) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Invalid response format'));
                    }
                } else {
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        reject(new Error(errorResponse.message || 'Upload failed'));
                    } catch (error) {
                        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                    }
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error occurred'));
            });

            xhr.open('POST', '/api/lessons');
            
            const token = localStorage.getItem('token');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            
            xhr.send(formData);
        });
    }

    static updateVideoProgress(percent, message) {
        const progressContainer = document.getElementById('videoUploadProgress');
        const progressBar = document.getElementById('uploadProgressBar');
        const progressText = document.getElementById('uploadProgressText');
        
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        if (progressText) {
            progressText.textContent = message;
        }
    }

    static hideVideoProgress() {
        const progressContainer = document.getElementById('videoUploadProgress');
        if (progressContainer) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 2000);
        }
    }

    static async updateLesson(id, formData) {
        try {
            this.showLoading(true);
            
            const lessonData = {
                course: formData.get('courseId'),
                title: formData.get('title'),
                description: formData.get('description'),
                type: formData.get('type'),
                order: parseInt(formData.get('order')) || 1,
                duration: parseInt(formData.get('duration')) || 0,
                content: {
                    video: formData.get('videoUrl') || '',
                    code: formData.get('codeExample') || '',
                    documents: formData.get('documents') ? formData.get('documents').split('\n').filter(d => d.trim()) : []
                },
                published: formData.get('published') === 'on'
            };

            const response = await AdminAPIService.updateLesson(id, lessonData);
            
            if (response.success) {
                this.showAlert('lessonsAlert', 'success', 'Cập nhật bài học thành công!');
                this.loadLessons(AdminLessonState.selectedCourseId);
                closeEditLessonModal();
            } else {
                this.showAlert('lessonsAlert', 'error', response.message || 'Không thể cập nhật bài học');
            }
        } catch (error) {
            console.error('Error updating lesson:', error);
            this.showAlert('lessonsAlert', 'error', 'Có lỗi xảy ra khi cập nhật bài học');
        } finally {
            this.showLoading(false);
        }
    }

    static async deleteLessonById(id) {
        try {
            this.showLoading(true);
            const response = await AdminAPIService.deleteLesson(id);
            
            if (response.success) {
                this.showAlert('lessonsAlert', 'success', 'Xóa bài học thành công!');
                this.loadLessons(AdminLessonState.selectedCourseId);
            } else {
                this.showAlert('lessonsAlert', 'error', response.message || 'Không thể xóa bài học');
            }
        } catch (error) {
            console.error('Error deleting lesson:', error);
            this.showAlert('lessonsAlert', 'error', 'Có lỗi xảy ra khi xóa bài học');
        } finally {
            this.showLoading(false);
        }
    }

    static async toggleAddLessonForm() {
        const form = document.getElementById('add-lesson');
        const button = document.querySelector('.btn-add-lesson');
        
        if (form && (form.style.display === 'none' || !form.style.display)) {
            // Load courses before showing form
            await this.loadCoursesForSelect();
            form.style.display = 'block';
            if (button) {
                button.innerHTML = '<i class="fas fa-minus"></i> Hủy thêm bài học';
            }
        } else if (form) {
            form.style.display = 'none';
            if (button) {
                button.innerHTML = '<i class="fas fa-plus"></i> Thêm bài học mới';
            }
            const lessonForm = document.getElementById('lessonForm');
            if (lessonForm) {
                lessonForm.reset();
            }
        }
    }

    static async loadCoursesForSelect() {
        try {
            console.log('🔄 Starting loadCoursesForSelect...');
            const response = await AdminAPIService.getAllCourses();
            console.log('📊 API Response:', response);
            
            if (response.success) {
                const courses = response.data.courses || [];
                console.log('📚 Loaded courses for select:', courses.length, 'courses');
                console.log('Course list:', courses.map(c => ({ id: c._id, name: c.name })));
                
                // Populate add lesson course select (try both old and new IDs)
                const addSelect = document.getElementById('lessonCourseId') || document.getElementById('courseSelect');
                console.log('🔍 Looking for lesson course select:', addSelect?.id || 'NOT FOUND');
                
                if (addSelect) {
                    const options = '<option value="">Chọn khóa học</option>' +
                        courses.map(course => 
                            `<option value="${course._id}">${course.name}</option>`
                        ).join('');
                    
                    addSelect.innerHTML = options;
                    console.log('✅ Populated lesson course select with', courses.length, 'courses');
                    console.log('🔧 Select ID:', addSelect.id);
                } else {
                    console.error('❌ No lesson course select found (tried: lessonCourseId, courseSelect)');
                    console.log('🔍 Available select elements:', 
                        Array.from(document.querySelectorAll('select')).map(el => ({ id: el.id, name: el.name })));
                }

                // Populate filter course select
                const filterSelect = document.getElementById('filterCourseSelect');
                if (filterSelect) {
                    filterSelect.innerHTML = '<option value="">Tất cả khóa học</option>' +
                        courses.map(course => 
                            `<option value="${course._id}">${course.name}</option>`
                        ).join('');
                    console.log('✅ Populated filter course select');
                } else {
                    console.log('⚠️ Filter course select not found: filterCourseSelect (this is normal)');
                }
            } else {
                console.error('❌ Failed to load courses:', response.message);
            }
        } catch (error) {
            console.error('💥 Error loading courses for select:', error);
        }
    }
}

// Lesson Management Functions
async function toggleAddLessonForm() {
    await AdminLessonManager.toggleAddLessonForm();
}

function filterLessonsByCourse() {
    const select = document.getElementById('filterCourseSelect');
    const courseId = select.value;
    AdminLessonManager.loadLessons(courseId || null);
}

// New simple lesson form submit handler
function handleNewLessonSubmit(event) {
    event.preventDefault();
    
    console.log('🚀 New lesson form submitted!');
    
    const form = event.target;
    const formData = new FormData(form);
    
    // Show debug info
    console.log('📋 Form data:');
    for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
            console.log(`  ${key}:`, `${value.name} (${Math.round(value.size/1024)}KB)`);
        } else {
            console.log(`  ${key}:`, value);
        }
    }
    
    // Validate required fields
    const courseId = formData.get('course') || formData.get('courseId');
    if (!courseId) {
        alert('❌ Vui lòng chọn khóa học!');
        return;
    }
    
    if (!formData.get('title')) {
        alert('❌ Vui lòng nhập tiêu đề bài học!');
        return;
    }
    
    // Check if we have video file or URL  
    const videoFile = formData.get('video'); // Changed from 'videoFile' to 'video'
    const videoUrl = formData.get('videoUrl');
    
    if (videoFile && videoFile.size > 0) {
        // Upload with video file
        console.log('📹 Uploading lesson with video file...');
        createLessonWithVideoFile(formData);
    } else {
        // Create lesson with URL only
        console.log('🔗 Creating lesson with video URL...');
        const lessonData = {
            course: courseId, // Use 'course' field for backend validation
            title: formData.get('title'),
            description: formData.get('description') || '',
            type: 'lesson',
            order: parseInt(formData.get('order')) || 1,
            duration: parseInt(formData.get('duration')) || 30,
            content: {
                video: videoUrl || '',
                code: '',
                documents: []
            },
            published: true
        };
        
        console.log('📝 Lesson data to send:', lessonData);
        
        // Validate courseId format for JSON request too
        const objectIdRegex = /^[0-9a-fA-F]{24}$/;
        if (!objectIdRegex.test(courseId)) {
            alert(`❌ ID khóa học không hợp lệ: ${courseId}`);
            return;
        }
        
        createNewLesson(lessonData);
    }
}

async function createNewLesson(lessonData) {
    try {
        console.log('🔄 Sending lesson data to API...');
        
        const token = localStorage.getItem('token');
        if (!token) {
            alert('❌ Chưa đăng nhập! Vui lòng đăng nhập lại.');
            return;
        }
        
        const response = await fetch('/api/lessons', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(lessonData)
        });
        
        const result = await response.json();
        console.log('📊 API Response:', result);
        
        if (result.success) {
            alert('✅ Tạo bài học thành công!');
            
            // Show success in debug info
            document.getElementById('formDebugInfo').style.display = 'block';
            document.getElementById('debugContent').innerHTML = `
                <strong>✅ Thành công!</strong><br>
                📝 ID: ${result.lesson._id}<br>
                📚 Tiêu đề: ${result.lesson.title}<br>
                🔢 Thứ tự: ${result.lesson.order}
            `;
            
            // Reset form and hide video preview
            document.getElementById('newLessonForm').reset();
            document.getElementById('videoPreview').style.display = 'none';
            document.getElementById('uploadProgress').style.display = 'none';
            
            // Refresh lessons list if available
            if (typeof AdminLessonManager !== 'undefined') {
                AdminLessonManager.loadLessons();
            }
            
        } else {
            console.error('❌ API Error:', result);
            alert(`❌ Lỗi: ${result.message || 'Không thể tạo bài học'}`);
            
            // Show error in debug info
            document.getElementById('formDebugInfo').style.display = 'block';
            document.getElementById('debugContent').innerHTML = `
                <strong>❌ Lỗi!</strong><br>
                ${result.message || 'Không thể tạo bài học'}
            `;
        }
    } catch (error) {
        console.error('❌ Network Error:', error);
        alert(`❌ Lỗi mạng: ${error.message}`);
        
        // Show error in debug info
        document.getElementById('formDebugInfo').style.display = 'block';
        document.getElementById('debugContent').innerHTML = `
            <strong>❌ Lỗi mạng!</strong><br>
            ${error.message}
        `;
    }
}

async function createLessonWithVideoFile(formData) {
    try {
        console.log('🎬 Uploading lesson with video file...');
        
        const token = localStorage.getItem('token');
        if (!token) {
            alert('❌ Chưa đăng nhập! Vui lòng đăng nhập lại.');
            return;
        }
        
        // Fix FormData field names for backend validation
        const courseId = formData.get('course') || formData.get('courseId');
        console.log('📚 Course ID from form:', courseId);
        
        if (!courseId) {
            alert('❌ Vui lòng chọn khóa học!');
            return;
        }
        
        // Ensure course field is set properly for backend
        if (!formData.get('course')) {
            formData.set('course', courseId);
        }
        
        // Validate courseId format (MongoDB ObjectId)
        const objectIdRegex = /^[0-9a-fA-F]{24}$/;
        if (!objectIdRegex.test(courseId)) {
            alert(`❌ ID khóa học không hợp lệ: ${courseId}`);
            return;
        }
        
        // Debug FormData before sending
        console.log('📋 FormData to upload:');
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(`  ${key}: FILE - ${value.name} (${value.size} bytes, ${value.type})`);
            } else {
                console.log(`  ${key}: ${value}`);
            }
        }
        
        // Show progress
        const progress = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        progress.style.display = 'block';
        progressBar.style.width = '10%';
        progressText.textContent = 'Đang upload video...';
        
        // Create XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = percentComplete + '%';
                progressText.textContent = `Đang upload... ${Math.round(percentComplete)}%`;
            }
        });
        
        xhr.addEventListener('load', () => {
            try {
                console.log('📡 Raw response status:', xhr.status);
                console.log('📡 Raw response text:', xhr.responseText);
                
                if (xhr.status !== 200 && xhr.status !== 201) {
                    throw new Error(`Server error: ${xhr.status} - ${xhr.responseText}`);
                }
                
                const result = JSON.parse(xhr.responseText);
                console.log('📊 Upload Response:', result);
                
                if (result.success) {
                    progressBar.style.width = '100%';
                    progressText.textContent = '✅ Upload hoàn thành!';
                    
                    setTimeout(() => {
                        alert('✅ Tạo bài học với video thành công!');
                        
                        // Show success in debug info
                        document.getElementById('formDebugInfo').style.display = 'block';
                        document.getElementById('debugContent').innerHTML = `
                            <strong>✅ Upload thành công!</strong><br>
                            📝 ID: ${result.lesson._id}<br>
                            📚 Tiêu đề: ${result.lesson.title}<br>
                            🎬 Video: ${result.lesson.content.video}
                        `;
                        
                        // Reset form
                        document.getElementById('newLessonForm').reset();
                        document.getElementById('videoPreview').style.display = 'none';
                        progress.style.display = 'none';
                        
                        // Refresh lessons list
                        if (typeof AdminLessonManager !== 'undefined') {
                            AdminLessonManager.loadLessons();
                        }
                    }, 1000);
                } else {
                    throw new Error(result.message || 'Upload failed');
                }
            } catch (error) {
                console.error('❌ Upload Error:', error);
                alert(`❌ Lỗi upload: ${error.message}`);
                progress.style.display = 'none';
            }
        });
        
        xhr.addEventListener('error', () => {
            console.error('❌ Network error during upload');
            alert('❌ Lỗi mạng khi upload video');
            progress.style.display = 'none';
        });
        
        xhr.open('POST', '/api/lessons');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
        
    } catch (error) {
        console.error('❌ Upload preparation error:', error);
        alert(`❌ Lỗi chuẩn bị upload: ${error.message}`);
        document.getElementById('uploadProgress').style.display = 'none';
    }
}

function handleAddLessonSubmit(event) {
    event.preventDefault();
    
    console.log('🔧 handleAddLessonSubmit triggered!', event);
    
    // Validate form
    const videoFile = document.getElementById('lessonVideoFile');
    const videoUrl = document.getElementById('lessonVideoUrl');
    
    if (videoFile && videoFile.files[0]) {
        const file = videoFile.files[0];
        const maxSize = 100 * 1024 * 1024; // 100MB
        
        if (file.size > maxSize) {
            alert('File video không được vượt quá 100MB');
            return;
        }
        
        const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
        if (!allowedTypes.includes(file.type)) {
            alert('Chỉ cho phép upload file video: MP4, AVI, MOV, WMV');
            return;
        }
    }
    
    const formData = new FormData(event.target);
    
    // Debug FormData
    console.log('🔧 FormData entries:');
    for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
    }
    
    AdminLessonManager.createLesson(formData);
}

// Handle video file selection
function handleVideoFileSelect(event) {
    const file = event.target.files[0];
    const feedback = document.getElementById('videoFileFeedback');
    
    if (!file) {
        feedback.textContent = '';
        feedback.style.color = '';
        return;
    }
    
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
    
    if (file.size > maxSize) {
        feedback.textContent = `File quá lớn (${Math.round(file.size / 1024 / 1024)}MB). Tối đa 100MB.`;
        feedback.style.color = 'var(--error-color)';
        event.target.value = '';
        return;
    }
    
    if (!allowedTypes.includes(file.type)) {
        feedback.textContent = 'Định dạng không hỗ trợ. Chỉ cho phép MP4, AVI, MOV, WMV.';
        feedback.style.color = 'var(--error-color)';
        event.target.value = '';
        return;
    }
    
    feedback.textContent = `✓ File hợp lệ: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`;
    feedback.style.color = 'var(--success-color)';
}

function handleEditLessonSubmit(event) {
    event.preventDefault();
    if (AdminLessonState.currentEditId) {
        const formData = new FormData(event.target);
        AdminLessonManager.updateLesson(AdminLessonState.currentEditId, formData);
    }
}

function viewLesson(lessonId) {
    const lesson = AdminLessonState.lessons.find(l => l._id === lessonId);
    if (lesson) {
        // Redirect to lesson detail page or show lesson preview
        window.open(`/lesson.html?id=${lessonId}`, '_blank');
    }
}

function editLesson(lessonId) {
    const lesson = AdminLessonState.lessons.find(l => l._id === lessonId);
    if (!lesson) return;

    AdminLessonState.currentEditId = lessonId;
    
    // Populate edit form
    document.getElementById('editLessonModal').style.display = 'block';
    
    // Fill form fields
    const form = document.getElementById('editLessonForm');
    if (form) {
        form.querySelector('#editCourseId').value = lesson.course?._id || '';
        form.querySelector('#editTitle').value = lesson.title;
        form.querySelector('#editDescription').value = lesson.description || '';
        form.querySelector('#editType').value = lesson.type;
        form.querySelector('#editOrder').value = lesson.order || 1;
        form.querySelector('#editDuration').value = lesson.duration || '';
        form.querySelector('#editVideoUrl').value = lesson.content?.video || '';
        form.querySelector('#editCodeExample').value = lesson.content?.code || '';
        form.querySelector('#editDocuments').value = lesson.content?.documents?.join('\n') || '';
        form.querySelector('#editPublished').checked = lesson.published || false;
    }
}

function deleteLesson(lessonId, lessonTitle) {
    console.log('🗑️ Delete lesson:', lessonId, lessonTitle);
    
    // Simple confirm dialog instead of modal
    const confirmed = confirm(`Bạn có chắc chắn muốn xóa bài học "${lessonTitle}"?\n\nHành động này không thể hoàn tác.`);
    
    if (confirmed) {
        AdminLessonManager.deleteLessonById(lessonId);
    }
}

function closeEditLessonModal() {
    document.getElementById('editLessonModal').style.display = 'none';
    AdminLessonState.currentEditId = null;
}

function closeDeleteLessonModal() {
    // Legacy function - no longer needed since we use confirm dialog
    AdminLessonState.currentDeleteId = null;
}

async function confirmDeleteLesson() {
    // Legacy function - no longer needed since we use confirm dialog
    console.log('confirmDeleteLesson called but not needed');
}

// Debug function for testing
async function testLoadCourses() {
    console.log('🧪 Manual test: Loading courses...');
    try {
        await AdminLessonManager.loadCoursesForSelect();
        alert('✅ Load courses completed! Check console for details.');
    } catch (error) {
        console.error('❌ Test failed:', error);
        alert('❌ Test failed: ' + error.message);
    }
}

// Missing lesson management functions
function openAddLessonModal() {
    console.log('🔧 Opening add lesson modal...');
    showSection('add-lesson');
}

function refreshLessonsList() {
    console.log('🔄 Refreshing lessons list...');
    const selectedCourseId = document.getElementById('courseFilterLessons')?.value || null;
    AdminLessonManager.loadLessons(selectedCourseId);
}

// Debug tool function
function openDebugTool() {
    window.open('/admin-debug.html', 'debug', 'width=800,height=600,scrollbars=yes,resizable=yes');
}

// New lesson form functions
function loadCoursesForNewForm() {
    console.log('🔄 Loading courses for new form...');
    
    const token = localStorage.getItem('token');
    if (!token) {
        alert('❌ Chưa đăng nhập! Vui lòng đăng nhập trước.');
        window.open('/login-test.html', '_blank');
        return;
    }
    
    fetch('/api/courses', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        console.log('📡 Response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('📊 Courses data:', data);
        
        // Handle different API response formats
        let courses = [];
        if (data.success) {
            courses = data.courses || data.data?.courses || data.data || [];
        } else if (data.data) {
            courses = data.data.courses || data.data || [];
        }
        
        console.log('📋 Parsed courses:', courses);
        
        if (courses && Array.isArray(courses) && courses.length > 0) {
            const courseSelect = document.getElementById('courseSelect');
            console.log('🔍 Course select element:', courseSelect);
            
            if (courseSelect) {
                courseSelect.innerHTML = '<option value="">-- Chọn khóa học --</option>';
                
                courses.forEach(course => {
                    const option = document.createElement('option');
                    option.value = course._id;
                    option.textContent = course.name;
                    courseSelect.appendChild(option);
                });
                
                console.log('✅ Loaded', courses.length, 'courses to courseSelect');
                
                // Show success message
                try {
                    const debugInfo = document.getElementById('formDebugInfo');
                    const debugContent = document.getElementById('debugContent');
                    if (debugInfo && debugContent) {
                        debugInfo.style.display = 'block';
                        debugContent.innerHTML = `
                            ✅ Đã tải ${courses.length} khóa học<br>
                            📋 Danh sách: ${courses.map(c => c.name).join(', ')}
                        `;
                    }
                } catch (debugError) {
                    console.log('⚠️ Debug info update failed (normal if elements not exist):', debugError.message);
                }
            } else {
                console.error('❌ Course select element with ID "courseSelect" not found!');
                console.log('🔍 Available select elements:', 
                    Array.from(document.querySelectorAll('select')).map(s => ({ id: s.id, name: s.name })));
            }
        } else {
            console.error('❌ No courses found in API response');
            console.log('Raw data:', data);
            alert(`❌ Không tìm thấy khóa học. Response: ${JSON.stringify(data).substring(0, 100)}...`);
        }
    })
    .catch(error => {
        console.error('❌ Error loading courses:', error);
        alert(`❌ Lỗi kết nối: ${error.message}`);
    });
}

function resetNewLessonForm() {
    document.getElementById('newLessonForm').reset();
    document.getElementById('formDebugInfo').style.display = 'none';
    console.log('🔄 Form reset');
}

function testNewLessonForm() {
    console.log('🧪 Testing new lesson form...');
    
    // Fill form with test data
    const courseSelect = document.getElementById('courseSelect');
    const titleInput = document.getElementById('lessonTitle');
    const orderInput = document.getElementById('lessonOrder');
    const durationInput = document.getElementById('lessonDuration');
    const descriptionInput = document.getElementById('lessonDescription');
    
    if (courseSelect.options.length > 1) {
        courseSelect.selectedIndex = 1;
    }
    
    titleInput.value = 'Test Lesson ' + Date.now();
    orderInput.value = Math.floor(Math.random() * 100) + 1;
    durationInput.value = '30';
    descriptionInput.value = 'This is a test lesson created automatically';
    
    console.log('✅ Form filled with test data');
    document.getElementById('formDebugInfo').style.display = 'block';
    document.getElementById('debugContent').innerHTML = '✅ Form đã được điền dữ liệu test';
}

function toggleFormDebug() {
    const debugInfo = document.getElementById('formDebugInfo');
    if (debugInfo.style.display === 'none') {
        debugInfo.style.display = 'block';
        
        // Show form values
        const form = document.getElementById('newLessonForm');
        const formData = new FormData(form);
        let debugContent = '<strong>📋 Form Data:</strong><br>';
        
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                debugContent += `• ${key}: ${value.name} (${Math.round(value.size/1024)}KB)<br>`;
            } else {
                debugContent += `• ${key}: ${value}<br>`;
            }
        }
        
        document.getElementById('debugContent').innerHTML = debugContent;
    } else {
        debugInfo.style.display = 'none';
    }
}

// Video file handling functions
function handleVideoFileSelect(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('videoPreview');
    const info = document.getElementById('videoInfo');
    
    if (!file) {
        preview.style.display = 'none';
        return;
    }
    
    // Validate file
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'];
    
    if (file.size > maxSize) {
        alert(`❌ File quá lớn! Kích thước: ${Math.round(file.size/1024/1024)}MB. Tối đa: 100MB`);
        event.target.value = '';
        preview.style.display = 'none';
        return;
    }
    
    if (!allowedTypes.includes(file.type)) {
        alert(`❌ Định dạng không hỗ trợ! File: ${file.type}. Chỉ cho phép: MP4, AVI, MOV, WMV, WebM`);
        event.target.value = '';
        preview.style.display = 'none';
        return;
    }
    
    // Show file info
    const fileSize = Math.round(file.size / 1024 / 1024 * 100) / 100;
    info.innerHTML = `
        ✅ <strong>${file.name}</strong><br>
        📏 Kích thước: ${fileSize}MB<br>
        🎬 Loại: ${file.type}<br>
        <span style="color: green;">Sẵn sàng để upload!</span>
    `;
    preview.style.display = 'block';
    
    console.log('✅ Video file selected:', {
        name: file.name,
        size: fileSize + 'MB',
        type: file.type
    });
}

// Function to check which form elements exist
function checkFormElements() {
    console.log('🔍 Checking form elements...');
    
    const elements = [
        'courseSelect',      // New form
        'lessonCourseId',    // Old form
        'newLessonForm',     // New form
        'lessonForm',        // Old form
        'lessonTitle',
        'lessonOrder',
        'lessonDuration'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        console.log(`  ${id}: ${element ? '✅ FOUND' : '❌ NOT FOUND'}`);
    });
    
    // List all select elements
    const selects = Array.from(document.querySelectorAll('select'));
    console.log('📋 All select elements:', selects.map(s => ({ id: s.id, name: s.name })));
    
    return elements.filter(id => document.getElementById(id));
}

// Debug function to test course API directly
async function debugCourseAPI() {
    console.log('🔧 Testing course API directly...');
    
    const token = localStorage.getItem('token');
    console.log('🔑 Token:', token ? token.substring(0, 50) + '...' : 'NONE');
    
    try {
        const response = await fetch('/api/courses', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers));
        
        const data = await response.json();
        console.log('📊 Raw API data:', data);
        console.log('📊 Data type:', typeof data);
        console.log('📊 Data keys:', Object.keys(data));
        
        if (data.courses) {
            console.log('📚 Courses found:', data.courses.length);
            console.log('📚 First course:', data.courses[0]);
        }
        
        // Show in UI
        alert(`API Test Result:\nStatus: ${response.status}\nCourses: ${data.courses?.length || 'None'}\nSuccess: ${data.success}`);
        
    } catch (error) {
        console.error('❌ API Error:', error);
        alert(`API Error: ${error.message}`);
    }
}

// Test lesson form submission
function testLessonFormSubmission() {
    console.log('🔧 Testing lesson form submission...');
    
    const form = document.getElementById('newLessonForm') || document.getElementById('lessonForm');
    if (!form) {
        console.error('❌ Lesson form not found!');
        return;
    }
    
    console.log('✅ Form found:', form);
    
    // Fill form with test data
    const courseSelect = document.getElementById('lessonCourseId');
    const titleInput = document.getElementById('lessonTitle');
    const orderInput = document.getElementById('lessonOrder');
    const durationInput = document.getElementById('lessonDuration');
    const descriptionInput = document.getElementById('lessonDescription');
    
    if (courseSelect && courseSelect.options.length > 1) {
        courseSelect.selectedIndex = 1; // Select first course
        console.log('✅ Course selected:', courseSelect.value);
    } else {
        console.error('❌ Course select not available');
    }
    
    if (titleInput) {
        titleInput.value = 'Test Lesson ' + Date.now();
        console.log('✅ Title set:', titleInput.value);
    }
    
    if (orderInput) {
        orderInput.value = '999';
        console.log('✅ Order set:', orderInput.value);
    }
    
    if (durationInput) {
        durationInput.value = '30';
        console.log('✅ Duration set:', durationInput.value);
    }
    
    if (descriptionInput) {
        descriptionInput.value = 'This is a test lesson created from console';
        console.log('✅ Description set:', descriptionInput.value);
    }
    
    // Trigger form submission
    console.log('🚀 Triggering form submit...');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

// Export for global access
window.AdminCourseManager = AdminCourseManager;
window.AdminUserManager = AdminUserManager;
window.AdminLessonManager = AdminLessonManager;
window.AdminAPIService = AdminAPIService;
window.AdminMessenger = AdminMessenger;
window.sendTeacherMessage = sendTeacherMessage;
window.testLoadCourses = testLoadCourses;
window.openAddLessonModal = openAddLessonModal;
window.openDebugTool = openDebugTool;
window.testLessonFormSubmission = testLessonFormSubmission;
window.loadCoursesForNewForm = loadCoursesForNewForm;
window.resetNewLessonForm = resetNewLessonForm;
window.testNewLessonForm = testNewLessonForm;
window.toggleFormDebug = toggleFormDebug;
window.handleVideoFileSelect = handleVideoFileSelect;
window.debugCourseAPI = debugCourseAPI;
window.checkFormElements = checkFormElements;
window.refreshLessonsList = refreshLessonsList;
window.handleVideoFileSelect = handleVideoFileSelect;