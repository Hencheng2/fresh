// Global variables
let currentPage = 1;
let isLoading = false;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the app if user is logged in
    if (document.getElementById('app-container').style.display !== 'none') {
        initializeApp();
    }
    
    // Setup authentication modal
    setupAuthModal();
    
    // Setup event listeners
    setupEventListeners();
});

// Initialize the main application
function initializeApp() {
    loadPosts();
    loadStories();
    loadContacts();
    loadSuggestions();
    loadChats();
    loadNotifications();
    
    // Set up periodic updates
    setInterval(loadNotifications, 30000); // Update notifications every 30 seconds
}

// Setup authentication modal functionality
function setupAuthModal() {
    const modal = document.getElementById('auth-modal');
    const closeBtn = document.querySelector('.close');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Close modal when clicking the X
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Tab switching functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update active tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabName}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    // Load more posts button
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMorePosts);
    }
    
    // Create post functionality
    const postInput = document.querySelector('.create-post input');
    if (postInput) {
        postInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && this.value.trim() !== '') {
                createPost(this.value);
                this.value = '';
            }
        });
    }
    
    // Post action buttons (photo/video, feeling, etc.)
    const postActionBtns = document.querySelectorAll('.post-action-btn');
    postActionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.querySelector('span').textContent;
            handlePostAction(action);
        });
    });
}

// Load posts from the server
function loadPosts() {
    if (isLoading) return;
    
    isLoading = true;
    const postsContainer = document.getElementById('posts-container');
    
    // Show loading indicator
    postsContainer.innerHTML = '<div class="loading" style="margin: 20px auto;"></div>';
    
    fetch(`/api/posts?page=${currentPage}`)
        .then(response => response.json())
        .then(data => {
            isLoading = false;
            
            if (data.posts.length === 0 && currentPage === 1) {
                postsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">No posts to show. Start connecting with friends!</p>';
                return;
            }
            
            if (currentPage === 1) {
                postsContainer.innerHTML = '';
            }
            
            data.posts.forEach(post => {
                const postElement = createPostElement(post);
                postsContainer.appendChild(postElement);
            });
            
            // Show/hide load more button
            const loadMoreBtn = document.getElementById('load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.style.display = data.has_next ? 'block' : 'none';
            }
        })
        .catch(error => {
            isLoading = false;
            console.error('Error loading posts:', error);
            postsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Error loading posts. Please try again.</p>';
        });
}

// Load more posts
function loadMorePosts() {
    currentPage++;
    loadPosts();
}

// Create a post element
function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'card post';
    postDiv.innerHTML = `
        <div class="post-user">
            <img src="/static/uploads/${post.author.profile_pic}" alt="${post.author.username}" class="profile-pic-small">
            <div class="post-user-info">
                <h4>${post.author.username}</h4>
                <span>${post.created_at}</span>
            </div>
        </div>
        <div class="post-content">
            <p>${post.content}</p>
            ${post.image ? `<img src="/static/uploads/${post.image}" alt="Post image" class="post-image">` : ''}
        </div>
        <div class="post-stats">
            <div class="likes-count">
                <span>${post.likes_count} likes</span>
            </div>
            <div class="comments-count">
                <span>${post.comments_count} comments</span>
            </div>
        </div>
        <div class="post-actions-row">
            <div class="reactions-container">
                <button class="post-action like-btn ${post.user_liked ? 'liked' : ''}" data-post-id="${post.id}">
                    <i class="fas fa-thumbs-up"></i>
                    <span>Like</span>
                </button>
                <div class="reactions-tooltip">
                    <span data-reaction="like">👍</span>
                    <span data-reaction="love">❤️</span>
                    <span data-reaction="haha">😄</span>
                    <span data-reaction="wow">😲</span>
                    <span data-reaction="sad">😢</span>
                    <span data-reaction="angry">😠</span>
                </div>
            </div>
            <button class="post-action comment-btn" data-post-id="${post.id}">
                <i class="fas fa-comment"></i>
                <span>Comment</span>
            </button>
            <button class="post-action share-btn" data-post-id="${post.id}">
                <i class="fas fa-share"></i>
                <span>Share</span>
            </button>
        </div>
        <div class="comments-section" id="comments-${post.id}" style="display: none;">
            <div class="comments-list"></div>
            <div class="add-comment">
                <input type="text" placeholder="Write a comment..." class="comment-input">
                <button class="comment-submit-btn" data-post-id="${post.id}">Post</button>
            </div>
        </div>
    `;
    
    // Add event listeners for the post
    setupPostEventListeners(postDiv, post);
    
    return postDiv;
}

// Setup event listeners for a post
function setupPostEventListeners(postElement, post) {
    // Like button
    const likeBtn = postElement.querySelector('.like-btn');
    likeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        likePost(post.id);
    });
    
    // Reaction buttons
    const reactionSpans = postElement.querySelectorAll('.reactions-tooltip span');
    reactionSpans.forEach(span => {
        span.addEventListener('click', function(e) {
            e.stopPropagation();
            const reaction = this.getAttribute('data-reaction');
            likePost(post.id, reaction);
        });
    });
    
    // Comment button
    const commentBtn = postElement.querySelector('.comment-btn');
    const commentsSection = postElement.querySelector('.comments-section');
    commentBtn.addEventListener('click', function() {
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
        
        if (commentsSection.style.display === 'block') {
            loadComments(post.id);
        }
    });
    
    // Comment submission
    const commentInput = postElement.querySelector('.comment-input');
    const commentSubmitBtn = postElement.querySelector('.comment-submit-btn');
    
    commentInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.trim() !== '') {
            addComment(post.id, this.value);
            this.value = '';
        }
    });
    
    commentSubmitBtn.addEventListener('click', function() {
        if (commentInput.value.trim() !== '') {
            addComment(post.id, commentInput.value);
            commentInput.value = '';
        }
    });
}

// Like a post
function likePost(postId, reaction = 'like') {
    fetch(`/like_post/${postId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reaction: reaction })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update the UI
            const postElement = document.querySelector(`.like-btn[data-post-id="${postId}"]`).closest('.post');
            const likesCount = postElement.querySelector('.likes-count span');
            likesCount.textContent = `${data.likes_count} likes`;
            
            // Update like button appearance
            const likeBtn = postElement.querySelector('.like-btn');
            likeBtn.classList.toggle('liked', data.likes_count > 0);
        }
    })
    .catch(error => {
        console.error('Error liking post:', error);
    });
}

// Add a comment to a post
function addComment(postId, content) {
    const formData = new FormData();
    formData.append('content', content);
    
    fetch(`/add_comment/${postId}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            loadComments(postId);
            
            // Update comments count
            const postElement = document.querySelector(`.comment-btn[data-post-id="${postId}"]`).closest('.post');
            const commentsCount = postElement.querySelector('.comments-count span');
            const currentCount = parseInt(commentsCount.textContent) || 0;
            commentsCount.textContent = `${currentCount + 1} comments`;
        }
    })
    .catch(error => {
        console.error('Error adding comment:', error);
    });
}

// Load comments for a post
function loadComments(postId) {
    // This would typically fetch comments from the server
    // For now, we'll simulate loading comments
    const commentsList = document.querySelector(`#comments-${postId} .comments-list`);
    commentsList.innerHTML = '<p>Loading comments...</p>';
    
    // Simulate API call delay
    setTimeout(() => {
        // In a real app, this would be actual comment data from the server
        commentsList.innerHTML = `
            <div class="comment">
                <img src="/static/uploads/default_profile.png" alt="User" class="comment-avatar">
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">John Doe</span>
                        <span class="comment-time">2 hours ago</span>
                    </div>
                    <p>This is a sample comment. In the full implementation, real comments would appear here.</p>
                </div>
            </div>
        `;
    }, 500);
}

// Create a new post
function createPost(content) {
    const formData = new FormData();
    formData.append('content', content);
    
    fetch('/create_post', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            // Reload the posts to show the new one
            currentPage = 1;
            loadPosts();
        }
    })
    .catch(error => {
        console.error('Error creating post:', error);
    });
}

// Handle post actions (photo, feeling, etc.)
function handlePostAction(action) {
    // This would open appropriate UI for the action
    alert(`Action: ${action} - This feature would be implemented in the full version`);
}

// Load stories
function loadStories() {
    const storiesContainer = document.querySelector('.stories-container');
    
    // Sample stories - in a real app, these would come from the server
    const stories = [
        { id: 1, user: 'Jane Smith', image: 'default_profile.png' },
        { id: 2, user: 'Mike Johnson', image: 'default_profile.png' },
        { id: 3, user: 'Sarah Williams', image: 'default_profile.png' },
        { id: 4, user: 'Tom Brown', image: 'default_profile.png' },
        { id: 5, user: 'Lisa Davis', image: 'default_profile.png' }
    ];
    
    stories.forEach(story => {
        const storyElement = document.createElement('div');
        storyElement.className = 'story-card';
        storyElement.innerHTML = `
            <div class="story-content">
                <img src="/static/uploads/${story.image}" alt="${story.user}" style="width: 100%; height: 100%; object-fit: cover;">
                <p>${story.user}</p>
            </div>
        `;
        
        storiesContainer.appendChild(storyElement);
    });
}

// Load contacts
function loadContacts() {
    const contactsList = document.querySelector('.contacts-list');
    
    // Sample contacts - in a real app, these would come from the server
    const contacts = [
        { id: 1, name: 'Jane Smith', image: 'default_profile.png', online: true },
        { id: 2, name: 'Mike Johnson', image: 'default_profile.png', online: true },
        { id: 3, name: 'Sarah Williams', image: 'default_profile.png', online: false },
        { id: 4, name: 'Tom Brown', image: 'default_profile.png', online: true },
        { id: 5, name: 'Lisa Davis', image: 'default_profile.png', online: false }
    ];
    
    contacts.forEach(contact => {
        const contactElement = document.createElement('div');
        contactElement.className = 'contact-item';
        contactElement.innerHTML = `
            <img src="/static/uploads/${contact.image}" alt="${contact.name}" class="contact-avatar">
            <span class="contact-name">${contact.name}</span>
            ${contact.online ? '<div class="chat-status"></div>' : ''}
        `;
        
        contactsList.appendChild(contactElement);
    });
}

// Load suggestions
function loadSuggestions() {
    const suggestionsList = document.querySelector('.suggestions-list');
    
    // Sample suggestions - in a real app, these would come from the server
    const suggestions = [
        { id: 1, name: 'Alex Thompson', mutual: 5, image: 'default_profile.png' },
        { id: 2, name: 'Emily Clark', mutual: 3, image: 'default_profile.png' },
        { id: 3, name: 'David Wilson', mutual: 8, image: 'default_profile.png' }
    ];
    
    suggestions.forEach(suggestion => {
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'suggestion-item';
        suggestionElement.innerHTML = `
            <img src="/static/uploads/${suggestion.image}" alt="${suggestion.name}" class="suggestion-avatar">
            <div style="flex: 1;">
                <div class="suggestion-name">${suggestion.name}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${suggestion.mutual} mutual friends</div>
            </div>
            <button class="btn-secondary" style="padding: 5px 10px; font-size: 12px;">Add</button>
        `;
        
        suggestionsList.appendChild(suggestionElement);
    });
}

// Load chats
function loadChats() {
    const chatsList = document.querySelector('.chats-list');
    
    // Sample chats - in a real app, these would come from the server
    const chats = [
        { id: 1, name: 'Jane Smith', preview: 'Hey, how are you?', unread: 2, image: 'default_profile.png', online: true },
        { id: 2, name: 'Mike Johnson', preview: 'See you tomorrow!', unread: 0, image: 'default_profile.png', online: true },
        { id: 3, name: 'Sarah Williams', preview: 'Did you see the new movie?', unread: 1, image: 'default_profile.png', online: false }
    ];
    
    chats.forEach(chat => {
        const chatElement = document.createElement('div');
        chatElement.className = 'chat-item';
        chatElement.innerHTML = `
            <img src="/static/uploads/${chat.image}" alt="${chat.name}" class="chat-avatar">
            <div class="chat-info">
                <div class="chat-name">${chat.name}</div>
                <div class="chat-preview">${chat.preview}</div>
            </div>
            ${chat.unread > 0 ? `<div class="badge">${chat.unread}</div>` : ''}
            ${chat.online ? '<div class="chat-status"></div>' : ''}
        `;
        
        chatsList.appendChild(chatElement);
    });
}

// Load notifications
function loadNotifications() {
    // This would fetch notifications from the server
    // For now, we'll just log to console
    console.log('Loading notifications...');
}

// Utility function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

// Add friend functionality
function addFriend(userId) {
    fetch(`/add_friend/${userId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Friend request sent!');
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('Error adding friend:', error);
    });
}
