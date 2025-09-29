// Global functions for post interactions
function setupPostInteractions() {
    // Like buttons
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const postId = this.getAttribute('data-post-id');
            likePost(postId);
        });
    });

    // Comment inputs
    document.querySelectorAll('.comment-input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const postId = this.getAttribute('data-post-id');
                addComment(postId, this.value);
                this.value = '';
            }
        });
    });
}

function likePost(postId) {
    fetch(`/like_post/${postId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reaction: 'like' })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
            const likesCount = postElement.querySelector('.likes-count');
            likesCount.textContent = `${data.likes_count} likes`;
            
            const likeBtn = postElement.querySelector('.like-btn');
            if (data.liked) {
                likeBtn.innerHTML = '<i class="fas fa-thumbs-up"></i> Liked';
                likeBtn.style.color = '#1877f2';
            } else {
                likeBtn.innerHTML = '<i class="fas fa-thumbs-up"></i> Like';
                likeBtn.style.color = '';
            }
        }
    })
    .catch(error => {
        console.error('Error liking post:', error);
    });
}

function addComment(postId, content) {
    if (!content.trim()) {
        return;
    }
    
    const formData = new FormData();
    formData.append('content', content);
    
    fetch(`/add_comment/${postId}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            location.reload();
        }
    })
    .catch(error => {
        console.error('Error adding comment:', error);
    });
}

function focusComment(postId) {
    const commentInput = document.querySelector(`.comment-input[data-post-id="${postId}"]`);
    if (commentInput) {
        commentInput.focus();
    }
}

// Friend functions
function addFriend(userId) {
    fetch(`/add_friend/${userId}`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            location.reload();
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('Error adding friend:', error);
    });
}

function acceptFriend(friendshipId) {
    fetch(`/accept_friend/${friendshipId}`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('Error accepting friend:', error);
    });
}

// Search functions
function searchUsers() {
    const searchTerm = document.getElementById('search-input')?.value;
    
    if (!searchTerm?.trim()) {
        return;
    }
    
    window.location.href = `/friends?search=${encodeURIComponent(searchTerm)}`;
}

// Auth modal functions
function setupAuthModal() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabName}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupPostInteractions();
    
    // Setup auth modal only on login page
    if (document.getElementById('auth-modal')) {
        setupAuthModal();
    }
});
