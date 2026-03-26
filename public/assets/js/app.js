// API Configuration
const API_BASE = 'http://localhost:3000/api';

// Application State
const AppState = {
    courses: [],
    filteredCourses: [],
    currentFilter: 'all',
    currentPage: 1,
    coursesPerPage: 6,
    isLoading: false,
    searchQuery: '',
    sortBy: 'newest'
};

// DOM Elements
const elements = {
    coursesGrid: document.getElementById('coursesGrid'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    hamburger: document.querySelector('.hamburger'),
    navMenu: document.querySelector('.nav-menu'),
    navLinks: document.querySelectorAll('.nav-link'),
    courseModal: document.getElementById('courseModal'),
    modalClose: document.querySelector('.close'),
    totalCourses: document.getElementById('totalCourses'),
    totalStudents: document.getElementById('totalStudents'),
    avgRating: document.getElementById('avgRating')
};

// API Service
class APIService {
    static async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    static async getCourses(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/courses?${queryString}`);
    }

    static async getCourse(id) {
        return this.request(`/courses/${id}`);
    }

    static async searchCourses(query, params = {}) {
        const queryString = new URLSearchParams({ q: query, ...params }).toString();
        return this.request(`/courses/search?${queryString}`);
    }

    static async getCoursesByCategory(category, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/courses/category/${category}?${queryString}`);
    }

    static async getCourseStats() {
        return this.request('/courses/stats');
    }

    static async getCurrentUser() {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No token found');
        }
        
        return this.request('/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    }
}

// Course Manager
class CourseManager {
    static async loadCourses(showLoading = true) {
        if (showLoading) {
            AppState.isLoading = true;
            this.showLoading();
        }

        try {
            let response;
            
            if (AppState.searchQuery) {
                response = await APIService.searchCourses(AppState.searchQuery, {
                    page: AppState.currentPage,
                    limit: AppState.coursesPerPage
                });
            } else if (AppState.currentFilter !== 'all') {
                response = await APIService.getCoursesByCategory(AppState.currentFilter, {
                    page: AppState.currentPage,
                    limit: AppState.coursesPerPage
                });
            } else {
                response = await APIService.getCourses({
                    page: AppState.currentPage,
                    limit: AppState.coursesPerPage,
                    isPublished: true
                });
            }

            if (response.success) {
                if (AppState.currentPage === 1) {
                    AppState.courses = response.data.courses || [];
                } else {
                    AppState.courses = [...AppState.courses, ...(response.data.courses || [])];
                }

                AppState.filteredCourses = [...AppState.courses];
                this.sortCourses();
                this.renderCourses();
                this.updateLoadMoreButton(response.data.pagination);
            } else {
                this.showError('Không thể tải khóa học. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Error loading courses:', error);
            this.showError('Có lỗi xảy ra khi tải khóa học.');
        } finally {
            AppState.isLoading = false;
        }
    }

    static async loadStats() {
        try {
            const response = await APIService.getCourseStats();
            if (response.success) {
                const stats = response.data.overview;
                this.animateNumber(elements.totalCourses, stats.totalCourses || 0);
                this.animateNumber(elements.totalStudents, stats.totalStudents || 0);
                this.animateNumber(elements.avgRating, (stats.averageRating || 0).toFixed(1));
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    static animateNumber(element, target) {
        if (!element) return;
        
        const start = 0;
        const duration = 2000;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.floor(start + (target - start) * progress);
            element.textContent = target % 1 === 0 ? current.toLocaleString() : current.toFixed(1);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    static sortCourses() {
        AppState.filteredCourses.sort((a, b) => {
            switch (AppState.sortBy) {
                case 'newest':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'oldest':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'price-low':
                    return a.price - b.price;
                case 'price-high':
                    return b.price - a.price;
                case 'rating':
                    return b.rating - a.rating;
                case 'students':
                    return b.studentsCount - a.studentsCount;
                default:
                    return 0;
            }
        });
    }

    static renderCourses() {
        if (!elements.coursesGrid) return;

        if (AppState.filteredCourses.length === 0) {
            elements.coursesGrid.innerHTML = `
                <div class="loading">
                    <i class="fas fa-search"></i>
                    <p>Không tìm thấy khóa học nào.</p>
                </div>
            `;
            return;
        }

        const coursesHTML = AppState.filteredCourses.map(course => this.createCourseCard(course)).join('');
        elements.coursesGrid.innerHTML = coursesHTML;

        // Add event listeners to course cards
        document.querySelectorAll('.course-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const courseId = card.dataset.courseId;
                
                // Check if clicked on a button or link inside the card
                if (e.target.closest('button') || e.target.closest('a')) {
                    return;
                }
                
                // Navigate to course detail page
                window.location.href = `course-detail.html?id=${courseId}`;
            });
            
            // Add hover effect
            card.style.cursor = 'pointer';
        });
    }

    static createCourseCard(course) {
        const levelClass = course.level.toLowerCase();
        const imageUrl = course.image || '/api/placeholder/350/200';
        const formattedPrice = course.price ? course.price.toLocaleString('vi-VN') + ' VND' : 'Miễn phí';
        const formattedDuration = course.duration ? Math.floor(course.duration / 60) + 'h ' + (course.duration % 60) + 'm' : '';

        return `
            <div class="course-card" data-course-id="${course._id}">
                <div class="course-image">
                    ${course.image ? 
                        `<img src="${imageUrl}" alt="${course.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                         <div class="course-image-placeholder" style="display:none;">
                            <i class="fas fa-play-circle"></i>
                         </div>` :
                        `<div class="course-image-placeholder">
                            <i class="fas fa-play-circle"></i>
                         </div>`
                    }
                    <div class="course-level ${levelClass}">${course.level}</div>
                </div>
                <div class="course-content">
                    <div class="course-category">${course.category}</div>
                    <h3 class="course-title">${course.name}</h3>
                    <p class="course-description">${course.description}</p>
                    <div class="course-meta">
                        <div class="course-meta-item">
                            <i class="fas fa-clock"></i>
                            <span>${formattedDuration}</span>
                        </div>
                        <div class="course-meta-item">
                            <i class="fas fa-users"></i>
                            <span>${course.studentsCount} học viên</span>
                        </div>
                        <div class="course-meta-item">
                            <i class="fas fa-user"></i>
                            <span>${course.instructor}</span>
                        </div>
                    </div>
                    <div class="course-footer">
                        <div class="course-price">${formattedPrice}</div>
                        <div class="course-rating">
                            <i class="fas fa-star"></i>
                            <span>${course.rating}</span>
                        </div>
                    </div>
                    <div class="course-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary btn-small" onclick="window.location.href='course-detail.html?id=${course._id}'" style="flex: 1;">
                            <i class="fas fa-eye"></i> Xem chi tiết
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); CourseManager.showCourseModal('${course._id}')" style="padding: 0.5rem;">
                            <i class="fas fa-info"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    static async showCourseModal(courseId) {
        if (!elements.courseModal) return;

        try {
            const response = await APIService.getCourse(courseId);
            if (response.success) {
                const course = response.data;
                const modalContent = document.getElementById('courseModalContent');
                
                modalContent.innerHTML = this.createCourseModalContent(course);
                elements.courseModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            console.error('Error loading course details:', error);
            this.showError('Không thể tải thông tin khóa học.');
        }
    }

    static createCourseModalContent(course) {
        const formattedPrice = course.price ? course.price.toLocaleString('vi-VN') + ' VND' : 'Miễn phí';
        const formattedDuration = course.duration ? Math.floor(course.duration / 60) + ' giờ ' + (course.duration % 60) + ' phút' : '';
        const imageUrl = course.image || '/api/placeholder/600/300';

        return `
            <div class="course-modal-header">
                <h2>${course.name}</h2>
                <div class="course-modal-meta">
                    <span class="course-category">${course.category}</span>
                    <span class="course-level">${course.level}</span>
                </div>
            </div>
            
            <div class="course-modal-image">
                ${course.image ? 
                    `<img src="${imageUrl}" alt="${course.name}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 12px;">` :
                    `<div style="width: 100%; height: 300px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 4rem;">
                        <i class="fas fa-play-circle"></i>
                     </div>`
                }
            </div>
            
            <div class="course-modal-content">
                <div class="course-modal-description">
                    <h3>Mô tả khóa học</h3>
                    <p>${course.description}</p>
                </div>
                
                <div class="course-modal-details">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <i class="fas fa-user-tie"></i>
                            <div>
                                <strong>Giảng viên</strong>
                                <p>${course.instructor}</p>
                            </div>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-clock"></i>
                            <div>
                                <strong>Thời lượng</strong>
                                <p>${formattedDuration}</p>
                            </div>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-users"></i>
                            <div>
                                <strong>Học viên</strong>
                                <p>${course.studentsCount} người</p>
                            </div>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-star"></i>
                            <div>
                                <strong>Đánh giá</strong>
                                <p>${course.rating}/5</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${course.tags && course.tags.length > 0 ? `
                    <div class="course-modal-tags">
                        <h4>Tags</h4>
                        <div class="tags-list">
                            ${course.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${course.video ? `
                    <div class="course-modal-video">
                        <h4>Video giới thiệu</h4>
                        <div class="video-container">
                            <a href="${course.video}" target="_blank" class="btn btn-primary">
                                <i class="fas fa-play"></i> Xem video
                            </a>
                        </div>
                    </div>
                ` : ''}
                
                <div class="course-modal-footer">
                    <div class="course-price-large">${formattedPrice}</div>
                    <button class="btn btn-primary btn-large">
                        <i class="fas fa-shopping-cart"></i>
                        Đăng ký ngay
                    </button>
                </div>
            </div>
            
            <style>
                .course-modal-header {
                    margin-bottom: 2rem;
                }
                
                .course-modal-header h2 {
                    margin-bottom: 1rem;
                    font-size: 2rem;
                }
                
                .course-modal-meta {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }
                
                .course-modal-meta .course-category {
                    background: var(--primary-color);
                    color: white;
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.875rem;
                    font-weight: 600;
                }
                
                .course-modal-meta .course-level {
                    background: var(--secondary-color);
                    color: white;
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.875rem;
                    font-weight: 600;
                }
                
                .course-modal-image {
                    margin-bottom: 2rem;
                }
                
                .course-modal-description {
                    margin-bottom: 2rem;
                }
                
                .course-modal-description h3 {
                    margin-bottom: 1rem;
                    color: var(--primary-color);
                }
                
                .detail-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-top: 1rem;
                }
                
                .detail-item {
                    display: flex;
                    gap: 1rem;
                    align-items: flex-start;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border-radius: var(--border-radius);
                }
                
                .detail-item i {
                    color: var(--primary-color);
                    font-size: 1.25rem;
                    margin-top: 0.25rem;
                }
                
                .course-modal-tags {
                    margin: 2rem 0;
                }
                
                .tags-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }
                
                .tag {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.875rem;
                    border: 1px solid var(--border-color);
                }
                
                .course-modal-video {
                    margin: 2rem 0;
                }
                
                .video-container {
                    margin-top: 1rem;
                }
                
                .course-modal-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 3rem;
                    padding-top: 2rem;
                    border-top: 2px solid var(--border-color);
                }
                
                .course-price-large {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--primary-color);
                }
                
                .btn-large {
                    padding: 1rem 2rem;
                    font-size: 1.125rem;
                }
                
                @media (max-width: 768px) {
                    .course-modal-footer {
                        flex-direction: column;
                        gap: 1rem;
                        text-align: center;
                    }
                    
                    .detail-grid {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        `;
    }

    static showLoading() {
        if (elements.coursesGrid) {
            elements.coursesGrid.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Đang tải khóa học...</p>
                </div>
            `;
        }
    }

    static showError(message) {
        if (elements.coursesGrid) {
            elements.coursesGrid.innerHTML = `
                <div class="loading">
                    <i class="fas fa-exclamation-triangle" style="color: var(--error-color);"></i>
                    <p style="color: var(--error-color);">${message}</p>
                </div>
            `;
        }
    }

    static updateLoadMoreButton(pagination) {
        if (!elements.loadMoreBtn) return;

        if (pagination && pagination.hasNext) {
            elements.loadMoreBtn.style.display = 'block';
        } else {
            elements.loadMoreBtn.style.display = 'none';
        }
    }

    static filterCourses(category) {
        AppState.currentFilter = category;
        AppState.currentPage = 1;
        AppState.courses = [];
        this.loadCourses();
    }

    static searchCourses(query) {
        AppState.searchQuery = query.trim();
        AppState.currentPage = 1;
        AppState.courses = [];
        this.loadCourses();
    }

    static sortCoursesByOption(sortBy) {
        AppState.sortBy = sortBy;
        this.sortCourses();
        this.renderCourses();
    }

    static loadMoreCourses() {
        AppState.currentPage++;
        this.loadCourses(false);
    }

    static async loadAiRecommendations() {
        const aiSuggestContainer = document.getElementById('aiSuggestContainer');
        if (!aiSuggestContainer) return;
        aiSuggestContainer.innerHTML = '<div class="loading"><i class="fas fa-robot"></i> Đang lấy gợi ý từ AI...</div>';
        try {
            // In dev (localhost) call the stable test endpoint so UI always has sample data
            const endpoint = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ?
                'http://localhost:3000/api/ai/recommendations/test' :
                'http://localhost:3000/api/ai/recommendations';

            const response = await fetch(endpoint);
            const data = await response.json();
            console.debug('AI recommendations response:', data);
            // Show a small banner if the data is coming from demo/fallback
            const fallbackSources = ['static-test', 'test-endpoint', 'smart-fallback-no-courses', 'fallback-db', 'smart-ai-fallback', 'demo'];
            const bannerId = 'aiFallbackBanner';
            // Remove existing banner
            const existing = document.getElementById(bannerId);
            if (existing) existing.remove();
            if (data && fallbackSources.includes(data.source)) {
                const banner = document.createElement('div');
                banner.id = bannerId;
                banner.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#fff3cd;color:#665200;padding:10px 14px;border:1px solid #ffeeba;border-radius:6px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.12);font-size:0.9rem;';
                banner.innerText = 'Dữ liệu demo — bật API keys / seed DB để có gợi ý cá nhân hoá.';
                document.body.appendChild(banner);
                setTimeout(() => banner.remove(), 8000);
            }
            if (data.success) {
                // Prefer learningPath if provided
                if (data.learningPath && data.learningPath.courses && data.learningPath.courses.length > 0) {
                    const stepsHtml = data.learningPath.courses.map((s, i) => `
                        <div class="ai-course-card">
                            <h3>${s.title || s.name || 'Bước ' + (i+1)}</h3>
                            <p>${s.description || ''}</p>
                            <div><strong>Thời lượng:</strong> ${s.duration || 'Chưa xác định'}</div>
                            <div><strong>Độ khó:</strong> ${s.difficulty || 'Chưa xác định'}</div>
                        </div>
                    `).join('');

                    aiSuggestContainer.innerHTML = `
                        <h2>🗺️ Lộ trình học đề xuất</h2>
                        <div class="ai-course-list">${stepsHtml}</div>
                    `;
                    return;
                }

                if (Array.isArray(data.recommendations)) {
                    if (data.recommendations.length === 0) {
                        aiSuggestContainer.innerHTML = '<div class="loading"><i class="fas fa-search"></i> Không có gợi ý khóa học phù hợp.</div>';
                        return;
                    }
                    aiSuggestContainer.innerHTML = `
                        <h2>💡 Gợi ý khóa học cho bạn</h2>
                        <div class="ai-course-list">
                            ${data.recommendations.map((course, idx) => `
                                <div class="ai-course-card">
                                    <h3>${course.title || 'Không có tiêu đề'}</h3>
                                    <p>${course.description && course.description !== 'undefined' ? course.description : 'Chưa có mô tả'}</p>
                                    <div><strong>Thời lượng:</strong> ${course.duration && course.duration !== 'undefined' ? course.duration : 'Chưa xác định'}</div>
                                    <div><strong>Độ khó:</strong> ${course.difficulty && course.difficulty !== 'undefined' ? course.difficulty : 'Chưa xác định'}</div>
                                    <div class="ai-rating">
                                        ${'<i class="fas fa-star" style="color:gold"></i>'.repeat(3)}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    return;
                }
            }

            aiSuggestContainer.innerHTML = '<div class="loading"><i class="fas fa-exclamation"></i> Không thể lấy gợi ý từ AI.</div>';
        } catch (err) {
            aiSuggestContainer.innerHTML = '<div class="loading"><i class="fas fa-exclamation"></i> Lỗi khi lấy gợi ý từ AI.</div>';
        }
    }
}

// Navigation Manager
class NavigationManager {
    static init() {
        this.setupMobileMenu();
        this.setupSmoothScroll();
        this.setupScrollEffects();
    }

    static setupMobileMenu() {
        if (elements.hamburger && elements.navMenu) {
            elements.hamburger.addEventListener('click', () => {
                elements.hamburger.classList.toggle('active');
                elements.navMenu.classList.toggle('active');
            });

            // Close menu when clicking on a link
            elements.navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    elements.hamburger.classList.remove('active');
                    elements.navMenu.classList.remove('active');
                });
            });
        }
    }

    static setupSmoothScroll() {
        elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        const headerHeight = 80;
                        const targetPosition = target.offsetTop - headerHeight;
                        window.scrollTo({
                            top: targetPosition,
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });
    }

    static setupScrollEffects() {
        const header = document.querySelector('.header');
        
        window.addEventListener('scroll', () => {
            if (window.scrollY > 100) {
                header?.classList.add('scrolled');
            } else {
                header?.classList.remove('scrolled');
            }
        });

        // Update active nav link based on scroll position
        const sections = document.querySelectorAll('section[id]');
        
        window.addEventListener('scroll', () => {
            const scrollPos = window.scrollY + 100;
            
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;
                const sectionId = section.getAttribute('id');
                
                if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                    elements.navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${sectionId}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        });
    }
}

// Event Listeners
class EventManager {
    static init() {
        this.setupCourseEvents();
        this.setupModalEvents();
        this.setupFormEvents();
    }

    static setupCourseEvents() {
        // Filter tabs
        elements.filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                elements.filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const filter = tab.dataset.filter;
                CourseManager.filterCourses(filter);
            });
        });

        // Search input
        if (elements.searchInput) {
            let searchTimeout;
            elements.searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    CourseManager.searchCourses(e.target.value);
                }, 500);
            });
        }

        // Sort select
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener('change', (e) => {
                CourseManager.sortCoursesByOption(e.target.value);
            });
        }

        // Load more button
        if (elements.loadMoreBtn) {
            elements.loadMoreBtn.addEventListener('click', () => {
                CourseManager.loadMoreCourses();
            });
        }
    }

    static setupModalEvents() {
        // Close modal
        if (elements.modalClose && elements.courseModal) {
            elements.modalClose.addEventListener('click', () => {
                elements.courseModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });

            // Close modal when clicking outside
            elements.courseModal.addEventListener('click', (e) => {
                if (e.target === elements.courseModal) {
                    elements.courseModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            });
        }

        // Close modal with ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && elements.courseModal?.style.display === 'block') {
                elements.courseModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    static setupFormEvents() {
        // Contact form
        const contactForm = document.querySelector('.contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleContactForm(contactForm);
            });
        }

        // Newsletter form
        const newsletter = document.querySelector('.newsletter');
        if (newsletter) {
            newsletter.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleNewsletterForm(newsletter);
            });
        }
    }

    static handleContactForm(form) {
        const formData = new FormData(form);
        
        // Simulate form submission
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
        submitButton.disabled = true;
        
        setTimeout(() => {
            alert('Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.');
            form.reset();
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }, 2000);
    }

    static handleNewsletterForm(form) {
        const email = form.querySelector('input[type="email"]').value;
        
        if (email) {
            const button = form.querySelector('button');
            const originalHTML = button.innerHTML;
            
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            button.disabled = true;
            
            setTimeout(() => {
                alert('Đăng ký thành công! Cảm ơn bạn đã quan tâm.');
                form.reset();
                button.innerHTML = originalHTML;
                button.disabled = false;
            }, 1500);
        }
    }
}

// Utility Functions
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const headerHeight = 80;
        const targetPosition = section.offsetTop - headerHeight;
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
}

function formatPrice(price) {
    return price ? price.toLocaleString('vi-VN') + ' VND' : 'Miễn phí';
}

function formatDuration(minutes) {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

// Intersection Observer for Animations
function setupAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements for animation
    document.querySelectorAll('.feature, .course-card, .contact-item').forEach(el => {
        observer.observe(el);
    });
}

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 EduPlatform Frontend Initialized');
    
    // Initialize managers
    NavigationManager.init();
    EventManager.init();
    
    // Load initial data
    CourseManager.loadCourses();
    CourseManager.loadStats();
    
    // Setup animations
    setupAnimations();
    
    // Add loading class to body for initial load
    document.body.classList.add('loading');
    
    // Remove loading class after everything is loaded
    window.addEventListener('load', () => {
        document.body.classList.remove('loading');
    });
    
    // Tự động tải gợi ý AI khi trang được load
    CourseManager.loadAiRecommendations();
});

// Export for global access
window.CourseManager = CourseManager;
window.APIService = APIService;