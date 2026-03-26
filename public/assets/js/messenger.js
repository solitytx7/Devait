/**
 * Facebook Messenger-style Chat Widget
 */
class MessengerWidget {
    constructor() {
        this.isOpen = false;
        this.socket = null;
        this.currentConversation = null;
        this.currentCourseId = null;
        this.currentUser = null;
        this.messages = [];
        this.unreadCount = 0;
        
        this.init();
    }

    async init() {
        // Check if user is logged in
        const token = localStorage.getItem('token');
        if (!token) {
            return; // Don't show widget if not logged in
        }

        try {
            const response = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            
            if (result.success) {
                this.currentUser = result.data;
                this.createWidget();
                this.connectSocket();
            }
        } catch (error) {
            console.error('Error initializing messenger:', error);
        }
    }

    createWidget() {
        // Remove existing widget if any
        const existing = document.getElementById('messengerWidget');
        if (existing) existing.remove();

        const widgetHTML = `
            <div id="messengerWidget" class="messenger-widget">
                <!-- Chat Button -->
                <button class="messenger-button" onclick="messengerWidget.toggle()">
                    <i class="fas fa-comments"></i>
                    <div class="messenger-badge" id="messengerBadge" style="display: none;">0</div>
                </button>

                <!-- Chat Window -->
                <div class="messenger-window" id="messengerWindow">
                    <!-- Connection Status -->
                    <div class="connection-status" id="connectionStatus">
                        Đang kết nối...
                    </div>

                    <!-- Header -->
                    <div class="messenger-header" id="messengerHeader">
                        <div class="messenger-header-info">
                            <div class="messenger-avatar" id="messengerAvatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="messenger-header-text">
                                <h4 id="messengerTitle">Chọn khóa học để chat</h4>
                                <p id="messengerStatus">Offline</p>
                            </div>
                        </div>
                        <button class="messenger-close" onclick="messengerWidget.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <!-- Teacher Inbox Area -->
                    <div id="messengerTeacherInbox" class="messenger-teacher-inbox"></div>

                    <!-- Messages Area -->
                    <div class="messenger-messages" id="messengerMessages">
                        <div class="messenger-empty">
                            <i class="fas fa-graduation-cap"></i>
                            <h3>Bắt đầu trò chuyện</h3>
                            <p>Vào trang chi tiết khóa học để chat với giảng viên</p>
                        </div>
                    </div>

                    <!-- Input Area -->
                    <div class="messenger-input">
                        <div class="messenger-input-container">
                            <textarea 
                                class="messenger-input-field" 
                                id="messengerInput"
                                placeholder="Nhập tin nhắn..."
                                rows="1"
                                disabled
                            ></textarea>
                            <button class="messenger-send-btn" id="messengerSendBtn" onclick="messengerWidget.sendMessage()" disabled>
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                        <div id="messengerReplyState"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', widgetHTML);
        this.setupEventListeners();
        // Nếu là giáo viên, hiển thị inbox ngay khi tạo widget
        if (this.currentUser && this.currentUser.role === 'teacher') {
            this.renderTeacherInbox();
        }
    }

    setupEventListeners() {
        const input = document.getElementById('messengerInput');
        if (input) {
            // Auto-resize textarea
            input.addEventListener('input', (e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                
                // Enable/disable send button
                const sendBtn = document.getElementById('messengerSendBtn');
                const hasText = e.target.value.trim().length > 0;
                sendBtn.disabled = !hasText || !this.currentConversation;
            });

            // Send on Enter (but allow Shift+Enter for new line)
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }

    connectSocket() {
        try {
            // Load Socket.IO if not already loaded
            if (typeof io === 'undefined') {
                const script = document.createElement('script');
                script.src = '/socket.io/socket.io.js';
                script.onload = () => this.initSocket();
                document.head.appendChild(script);
            } else {
                this.initSocket();
            }
        } catch (error) {
            console.error('Error connecting socket:', error);
        }
    }

    initSocket() {
        const token = localStorage.getItem('token');
        if (!token) return;

        this.socket = io({
            auth: { token }
        });

        this.socket.on('connect', () => {
            console.log('Messenger connected to socket');
            this.updateConnectionStatus('connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Messenger disconnected from socket');
            this.updateConnectionStatus('disconnected');
        });

        this.socket.on('new_message', (message) => {
            if (message.conversation === this.currentConversation?._id) {
                this.addMessage(message);
            } else {
                this.incrementUnreadCount();
            }
        });

        this.socket.on('user_typing', (data) => {
            if (data.conversationId === this.currentConversation?._id) {
                this.showTypingIndicator(data.user);
            }
        });

        this.socket.on('user_stop_typing', () => {
            this.hideTypingIndicator();
        });
    }

    updateConnectionStatus(status) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.className = `connection-status ${status}`;
            
            if (status === 'connected') {
                statusEl.textContent = 'Đã kết nối';
                statusEl.classList.add('show');
                setTimeout(() => statusEl.classList.remove('show'), 2000);
            } else {
                statusEl.textContent = 'Mất kết nối';
                statusEl.classList.add('show');
            }
        }
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        const window = document.getElementById('messengerWindow');
        const button = document.querySelector('.messenger-button');
        
        if (window && button) {
            this.isOpen = true;
            button.classList.add('active');
            window.classList.add('show');
            
            // Focus input if conversation is active
            if (this.currentConversation) {
                setTimeout(() => {
                    const input = document.getElementById('messengerInput');
                    if (input && !input.disabled) input.focus();
                }, 300);
            }
        }
    }

    close() {
        const window = document.getElementById('messengerWindow');
        const button = document.querySelector('.messenger-button');
        
        if (window && button) {
            this.isOpen = false;
            button.classList.remove('active');
            window.classList.remove('show');
        }
    }

    async startChatWithInstructor(courseId) {
        this.currentCourseId = courseId;
        
        // Show loading state first
        this.showLoading();
        this.open();
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                this.showError('Vui lòng đăng nhập để chat với giảng viên');
                return;
            }

            const response = await fetch(`/api/chat/conversations/${courseId}/instructor`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();

            if (result.success) {
                this.currentConversation = result.data;
                await this.loadConversation();
            } else {
                if (response.status === 404) {
                    this.showError('Không tìm thấy giảng viên cho khóa học này');
                } else {
                    this.showError(result.message || 'Không thể kết nối với giảng viên');
                }
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            this.showError('Có lỗi xảy ra khi kết nối với giảng viên');
        }
    }

    async loadConversation() {
        if (!this.currentConversation) return;

        // Update header
        this.updateHeader();
        
        // Load messages
        await this.loadMessages();
        
        // Enable input
        const input = document.getElementById('messengerInput');
        const sendBtn = document.getElementById('messengerSendBtn');
        if (input && sendBtn) {
            input.disabled = false;
            input.placeholder = `Nhắn tin với ${this.currentConversation.partner.name}...`;
        }

        // Join conversation room
        if (this.socket) {
            this.socket.emit('join_conversation', this.currentConversation._id);
        }
    }

    updateHeader() {
        if (!this.currentConversation) return;

        const avatar = document.getElementById('messengerAvatar');
        const title = document.getElementById('messengerTitle');
        const status = document.getElementById('messengerStatus');

        if (avatar && title && status) {
            const partner = this.currentConversation.partner;
            avatar.textContent = this.getInitials(partner.name);
            title.textContent = partner.name;
            status.textContent = 'Online';
        }
    }

    async loadMessages() {
        const messagesContainer = document.getElementById('messengerMessages');
        if (!messagesContainer || !this.currentConversation) return;

        messagesContainer.innerHTML = '<div class="messenger-loading"><i class="fas fa-spinner fa-spin"></i></div>';

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/chat/conversations/${this.currentConversation._id}/messages?page=1&limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();

            if (result.success) {
                this.messages = result.data.messages.reverse(); // Reverse to show oldest first
                this.renderMessages();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            this.showError('Không thể tải tin nhắn');
        }
    }

    renderMessages() {
        const messagesContainer = document.getElementById('messengerMessages');
        if (!messagesContainer) return;

        if (this.messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="messenger-empty">
                    <i class="fas fa-comments"></i>
                    <h3>Bắt đầu cuộc trò chuyện</h3>
                    <p>Gửi tin nhắn đầu tiên cho giảng viên</p>
                </div>
            `;
            return;
        }

        messagesContainer.innerHTML = this.messages.map(message => 
            this.createMessageHTML(message)
        ).join('');

        // Scroll to bottom
        this.scrollToBottom();
    }

    createMessageHTML(message) {
        try {
            console.log('Creating message HTML for:', message);
            
            // Kiểm tra sender tồn tại
            if (!message.sender) {
                console.error('Message missing sender:', message);
                return '';
            }
            
            const isOutgoing = message.sender._id === this.currentUser._id;
            const time = this.formatTime(message.createdAt);
            let replyHtml = '';
            if (message.replyTo && message.replyTo.content) {
                replyHtml = `<div class="message-reply">
                    <div class="reply-author">${message.replyTo.sender?.name || 'Ẩn danh'}</div>
                    <div class="reply-content">${this.escapeHtml(message.replyTo.content)}</div>
                </div>`;
            }
                // Thêm nút trả lời cho tin nhắn từ user gửi đến giáo viên
                let replyBtn = '';
                if (!isOutgoing && this.currentUser.role === 'teacher') {
                    replyBtn = `<button class="reply-btn" onclick="messengerWidget.setReplyTo('${message._id}', '${message.sender.name}', '${this.escapeHtml(message.content)}')">Trả lời</button>`;
                }
            return `
                <div class="message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}">
                    ${replyHtml}
                    ${this.escapeHtml(message.content)}
                    <div class="message-time">${time}</div>
                        ${replyBtn}
                </div>
            `;
        } catch (error) {
            console.error('Error creating message HTML:', error, message);
            return '';
        }
    }

    // Hàm xử lý khi nhấn nút trả lời — đặt trạng thái reply và hiển thị UI
    setReplyTo(messageId, senderName, content) {
        this.replyToMessageId = messageId;
        const replyState = document.getElementById('messengerReplyState');
        if (replyState) {
            replyState.innerHTML = `<div class="replying-state">Đang trả lời <b>${this.escapeHtml(senderName)}</b>: ${this.escapeHtml(content)} <button onclick="messengerWidget.cancelReply()">Hủy</button></div>`;
        }
    }

    // Hàm hủy trạng thái trả lời
    cancelReply() {
        this.replyToMessageId = null;
        const replyState = document.getElementById('messengerReplyState');
        if (replyState) replyState.innerHTML = '';
    }

    addMessage(message) {
        this.messages.push(message);
        const messagesContainer = document.getElementById('messengerMessages');
        if (messagesContainer) {
            if (messagesContainer.querySelector('.messenger-empty')) {
                messagesContainer.innerHTML = '';
            }
            messagesContainer.insertAdjacentHTML('beforeend', this.createMessageHTML(message));
            this.scrollToBottom();
        }
        // Nếu là giáo viên, cập nhật inbox
        if (this.currentUser && this.currentUser.role === 'teacher') {
            this.renderTeacherInbox();
        }
        if (this.isOpen) {
            this.clearUnreadCount();
        }
    }

    async sendMessage() {
        console.log('🚀 messengerWidget.sendMessage() called');
        
        const input = document.getElementById('messengerInput');
        const content = input?.value.trim();
        
        console.log('📝 Input element:', input);
        console.log('📝 Content:', content);
        console.log('📝 Current conversation:', this.currentConversation);
        
        if (!content || !this.currentConversation) {
            console.log('❌ Cannot send: content or conversation missing');
            return;
        }

        // Lấy ID tin nhắn gốc nếu đang ở chế độ trả lời
        const replyTo = this.replyToMessageId || null;

        try {
            const token = localStorage.getItem('token');
            const body = { content };
            if (replyTo) body.replyTo = replyTo;
            
            console.log('Sending message...', { content, replyTo, conversationId: this.currentConversation._id });
            
            const response = await fetch(`/api/chat/conversations/${this.currentConversation._id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            const result = await response.json();
            console.log('Send message result:', result);

            if (result.success) {
                // Xóa input ngay lập tức
                input.value = '';
                input.style.height = 'auto';
                const sendBtn = document.getElementById('messengerSendBtn');
                if (sendBtn) sendBtn.disabled = true;
                
                // Thêm tin nhắn mới vào danh sách
                const newMessage = result.data;
                console.log('New message received:', newMessage);
                
                // Đảm bảo message có sender info đầy đủ
                if (!newMessage.sender || !newMessage.sender._id) {
                    console.log('Message missing sender, using current user');
                    newMessage.sender = this.currentUser;
                }
                
                console.log('Adding message to UI...');
                // Sử dụng addMessage method có sẵn
                this.addMessage(newMessage);
                console.log('Message added successfully');
                
                // Xóa trạng thái trả lời sau khi gửi
                this.replyToMessageId = null;
                this.cancelReply();
            } else {
                console.error('Send message failed:', result.message);
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Không thể gửi tin nhắn: ' + error.message);
        }
    }

    showTypingIndicator(user) {
        const messagesContainer = document.getElementById('messengerMessages');
        if (!messagesContainer) return;

        // Remove existing typing indicator
        this.hideTypingIndicator();

        const typingHTML = `
            <div class="typing-indicator" id="typingIndicator">
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        messagesContainer.insertAdjacentHTML('beforeend', typingHTML);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    incrementUnreadCount() {
        this.unreadCount++;
        this.updateBadge();
    }

    clearUnreadCount() {
        this.unreadCount = 0;
        this.updateBadge();
    }

    updateBadge() {
        const badge = document.getElementById('messengerBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
            } else {
                badge.style.display = 'none';
            }
        }
    }

    showLoading() {
        const messagesContainer = document.getElementById('messengerMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="messenger-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    Đang kết nối...
                </div>
            `;
        }
        
        // Update header
        const title = document.getElementById('messengerTitle');
        const status = document.getElementById('messengerStatus');
        if (title && status) {
            title.textContent = 'Đang kết nối...';
            status.textContent = 'Offline';
        }
    }

    showError(message) {
        const messagesContainer = document.getElementById('messengerMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="messenger-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Lỗi kết nối</h3>
                    <p>${message}</p>
                    <button class="messenger-retry-btn" onclick="window.messengerWidget.startChatWithInstructor('${this.currentCourseId}')">
                        Thử lại
                    </button>
                </div>
            `;
        }
        
        // Update header
        const title = document.getElementById('messengerTitle');
        const status = document.getElementById('messengerStatus');
        if (title && status) {
            title.textContent = 'Lỗi kết nối';
            status.textContent = 'Offline';
        }
        
        // Disable input
        const input = document.getElementById('messengerInput');
        const sendBtn = document.getElementById('messengerSendBtn');
        if (input && sendBtn) {
            input.disabled = true;
            input.placeholder = 'Không thể gửi tin nhắn';
            sendBtn.disabled = true;
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messengerMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    getInitials(name) {
        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else if (diffDays === 1) {
            return 'Hôm qua ' + date.toLocaleTimeString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else if (diffDays < 7) {
            return date.toLocaleDateString('vi-VN', { 
                weekday: 'short',
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else {
            return date.toLocaleDateString('vi-VN', { 
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        const widget = document.getElementById('messengerWidget');
        if (widget) {
            widget.remove();
        }
    }
}

// Global messenger instance
let messengerWidget = null;

// Initialize messenger when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other scripts to load
    setTimeout(() => {
        if (typeof messengerWidget === 'undefined' || messengerWidget === null) {
            window.messengerWidget = new MessengerWidget();
        }
    }, 1500);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (messengerWidget) {
        messengerWidget.destroy();
    }
});