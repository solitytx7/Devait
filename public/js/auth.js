// Authentication utilities
class AuthManager {
    constructor() {
        this.API_BASE = '/api/auth';
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        
        // Initialize auth state
        this.init();
    }

    async init() {
        if (this.token) {
            await this.verifyToken();
        }
        this.updateUI();
    }

    // Verify token and get current user
    async verifyToken() {
        try {
            const response = await fetch(`${this.API_BASE}/me`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.data;
                localStorage.setItem('user', JSON.stringify(this.currentUser));
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            this.logout();
            return false;
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token && !!this.currentUser;
    }

    // Check if user has specific role
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }

    // Check if user has any of the specified roles
    hasAnyRole(roles) {
        return this.currentUser && roles.includes(this.currentUser.role);
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Get token for API requests
    getToken() {
        return this.token;
    }

    // Logout user
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.token = null;
        this.currentUser = null;
        
        // Redirect to home if not already there
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = '/';
        } else {
            this.updateUI();
        }
    }

    // Update UI based on auth state
    updateUI() {
        this.updateNavigation();
        this.updateAuthButtons();
        this.updateUserInfo();
    }

    // Update navigation menu
    updateNavigation() {
        const nav = document.querySelector('.nav-menu');
        if (!nav) return;

        // Remove existing dynamically created auth items (not the default one)
        const dynamicAuthItems = nav.querySelectorAll('.auth-item:not(.default-auth)');
        dynamicAuthItems.forEach(item => item.remove());

        // Get default auth item
        const defaultAuthItem = nav.querySelector('.auth-item.default-auth');

        if (this.isAuthenticated()) {
            // Hide default auth button
            if (defaultAuthItem) {
                defaultAuthItem.style.display = 'none';
            }

            // Add user menu
            const userMenu = this.createUserMenu();
            nav.appendChild(userMenu);

            // Add admin link for admin/teacher
            if (this.hasAnyRole(['admin', 'teacher'])) {
                const adminLink = this.createNavItem('/admin.html', 'Quản lý', 'auth-item admin-link');
                nav.appendChild(adminLink);
            }
        } else {
            // Show default auth button
            if (defaultAuthItem) {
                defaultAuthItem.style.display = 'block';
            }
        }
    }

    // Create navigation item
    createNavItem(href, text, className = '') {
        const li = document.createElement('li');
        li.className = className;
        li.innerHTML = `<a href="${href}">${text}</a>`;
        return li;
    }

    // Create user dropdown menu
    createUserMenu() {
        const li = document.createElement('li');
        li.className = 'auth-item user-menu';
        li.innerHTML = `
            <div class="dropdown">
                <a href="#" class="dropdown-toggle">
                    <span class="user-avatar">${this.currentUser.name.charAt(0).toUpperCase()}</span>
                    ${this.currentUser.name}
                    <span class="role-badge role-${this.currentUser.role}">${this.getRoleText(this.currentUser.role)}</span>
                </a>
                <div class="dropdown-menu">
                    <a href="/profile.html">
                        <i class="fas fa-user"></i> Hồ sơ cá nhân
                    </a>
                    <a href="#" onclick="authManager.showProfile()">
                        <i class="fas fa-id-card"></i> Thông tin tài khoản
                    </a>
                    <a href="#" onclick="authManager.showChangePassword()">
                        <i class="fas fa-key"></i> Đổi mật khẩu
                    </a>
                    <a href="/security-questions.html">
                        <i class="fas fa-shield-alt"></i> Câu hỏi bảo mật
                    </a>
                    <div class="dropdown-divider"></div>
                    <a href="#" onclick="authManager.logout()">
                        <i class="fas fa-sign-out-alt"></i> Đăng xuất
                    </a>
                </div>
            </div>
        `;
        return li;
    }

    // Get role text in Vietnamese
    getRoleText(role) {
        const roleTexts = {
            'admin': 'Quản trị viên',
            'teacher': 'Giáo viên',
            'user': 'Học viên'
        };
        return roleTexts[role] || role;
    }

    // Update auth buttons on pages
    updateAuthButtons() {
        const authButtons = document.querySelectorAll('.auth-button');
        authButtons.forEach(button => {
            if (this.isAuthenticated()) {
                button.style.display = 'none';
            } else {
                button.style.display = 'block';
            }
        });
    }

    // Update user info displays
    updateUserInfo() {
        const userInfoElements = document.querySelectorAll('.user-info');
        userInfoElements.forEach(element => {
            if (this.isAuthenticated()) {
                const welcomeMessage = element.querySelector('.welcome-message span');
                if (welcomeMessage) {
                    welcomeMessage.textContent = `Chào mừng trở lại, ${this.currentUser.name}!`;
                }
                element.style.display = 'block';
            } else {
                element.style.display = 'none';
            }
        });
    }

    // Show profile modal
    showProfile() {
        // This would open a modal with user profile information
        alert(`Thông tin cá nhân:\nTên: ${this.currentUser.name}\nEmail: ${this.currentUser.email}\nVai trò: ${this.getRoleText(this.currentUser.role)}`);
    }

    // Show change password modal
    showChangePassword() {
        const currentPassword = prompt('Mật khẩu hiện tại:');
        if (!currentPassword) return;

        const newPassword = prompt('Mật khẩu mới (ít nhất 6 ký tự, bao gồm chữ hoa, chữ thường và số):');
        if (!newPassword) return;

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
        if (!passwordRegex.test(newPassword)) {
            alert('Mật khẩu mới không đúng định dạng!');
            return;
        }

        this.changePassword(currentPassword, newPassword);
    }

    // Change password
    async changePassword(currentPassword, newPassword) {
        try {
            const response = await fetch(`${this.API_BASE}/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Đổi mật khẩu thành công!');
            } else {
                alert(data.message || 'Đổi mật khẩu thất bại!');
            }
        } catch (error) {
            console.error('Change password error:', error);
            alert('Lỗi kết nối server!');
        }
    }

    // Make authenticated API request
    async apiRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        if (this.token) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, { ...defaultOptions, ...options });

        // Handle unauthorized response
        if (response.status === 401) {
            this.logout();
            throw new Error('Unauthorized');
        }

        return response;
    }

    // Protect admin routes
    requireAdmin() {
        if (!this.isAuthenticated()) {
            window.location.href = '/auth.html';
            return false;
        }

        if (!this.hasRole('admin')) {
            alert('Bạn không có quyền truy cập trang này!');
            window.location.href = '/';
            return false;
        }

        return true;
    }

    // Protect teacher or admin routes
    async requireTeacherOrAdmin() {
        console.log('🔐 requireTeacherOrAdmin called');
        console.log('🔐 isAuthenticated:', this.isAuthenticated());
        console.log('🔐 user:', this.currentUser);
        
        // First verify token if we think we're authenticated
        if (this.token) {
            const isValid = await this.verifyToken();
            if (!isValid) {
                console.log('🔐 Token verification failed, redirecting to /auth.html');
                window.location.href = '/auth.html';
                return false;
            }
        }
        
        if (!this.isAuthenticated()) {
            console.log('🔐 Not authenticated, redirecting to /auth.html');
            window.location.href = '/auth.html';
            return false;
        }

        const hasRole = this.hasAnyRole(['teacher', 'admin']);
        console.log('🔐 hasAnyRole(teacher, admin):', hasRole);
        
        if (!hasRole) {
            console.log('🔐 No teacher/admin role, redirecting to /');
            alert('Bạn không có quyền truy cập trang này!');
            window.location.href = '/';
            return false;
        }

        console.log('🔐 requireTeacherOrAdmin passed');
        return true;
    }

    // Protect authenticated routes
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/auth.html';
            return false;
        }

        return true;
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// CSS for user menu styling
const authStyles = `
    .dropdown {
        position: relative;
        display: inline-block;
    }

    .dropdown-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 25px;
        color: white;
        text-decoration: none;
        transition: background 0.3s ease;
    }

    .dropdown-toggle:hover {
        background: rgba(255, 255, 255, 0.2);
    }

    .user-avatar {
        width: 32px;
        height: 32px;
        background: var(--primary-color, #2563eb);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 14px;
    }

    .role-badge {
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
    }

    .role-admin {
        background: #ef4444;
    }

    .role-teacher {
        background: #10b981;
    }

    .role-user {
        background: #6b7280;
    }

    .dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: white;
        border-radius: 10px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        min-width: 200px;
        padding: 10px 0;
        display: none;
        z-index: 1000;
        margin-top: 5px;
    }

    .dropdown:hover .dropdown-menu {
        display: block;
    }

    .dropdown-menu a {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 20px;
        color: #374151;
        text-decoration: none;
        transition: background 0.2s ease;
        font-size: 14px;
    }

    .dropdown-menu a:hover {
        background: #f3f4f6;
        color: #1f2937;
    }

    .dropdown-menu a i {
        width: 16px;
        color: #6b7280;
        transition: color 0.2s ease;
    }

    .dropdown-menu a:hover i {
        color: #3b82f6;
    }

    .dropdown-divider {
        height: 1px;
        background: #e5e7eb;
        margin: 5px 0;
    }

    .admin-link a {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        transition: transform 0.2s ease;
    }

    .admin-link a:hover {
        transform: translateY(-2px);
    }

    .login-link a {
        background: var(--primary-color, #2563eb);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        transition: all 0.2s ease;
    }

    .login-link a:hover {
        background: var(--primary-dark, #1d4ed8);
        transform: translateY(-2px);
    }

    .default-auth .auth-btn {
        background: var(--primary-color, #2563eb);
        color: white !important;
        padding: 8px 16px;
        border-radius: 20px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .default-auth .auth-btn:hover {
        background: var(--primary-dark, #1d4ed8);
        transform: translateY(-2px);
    }

    .default-auth .auth-btn i {
        font-size: 14px;
    }

    .welcome-message {
        background: rgba(37, 99, 235, 0.1);
        color: var(--primary-color, #2563eb);
        padding: 12px 20px;
        border-radius: 25px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        margin-bottom: 1rem;
        border: 2px solid rgba(37, 99, 235, 0.2);
    }

    .welcome-message i {
        color: #f59e0b;
        animation: wave 2s ease-in-out infinite;
    }

    @keyframes wave {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(20deg); }
        75% { transform: rotate(-10deg); }
    }
`;

// Add styles to page
const styleSheet = document.createElement('style');
styleSheet.textContent = authStyles;
document.head.appendChild(styleSheet);