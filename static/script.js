let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('app-container').style.display !== 'none') {
        initializeApp();
    }
    setupAuthModal();
    setupEventListeners();
});

function initializeApp() {
    loadFriends();
    setupProfileUpdates();
}

function setupAuthModal() {
    const modal = document.getElementById('auth-modal');
    const closeBtn = document.querySelector('.close');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
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

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchUsers();
            }
        });
    }

    const createPostForm = document.getElementById('create-post-form');
    if (createPostForm) {
        createPostForm.addEventListener('submit', function(e) {
            e.preventDefault();
            createPost();
        });
    }

    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const postId = this.getAttribute('data-post-id');
            likePost(postId);
        });
    });

    document.querySelectorAll('.comment-input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const postId = this.getAttribute('data-post-id');
                addComment(postId, this.value);
                this.value = '';
            }
        });
    });

    const profilePicInput = document.getElementById('profile-pic-input');
    const coverPhotoInput = document.getElementById('cover-photo-input');
    
    if (profilePicInput) {
        profilePicInput.addEventListener('change', function() {
            updateProfile();
        });
    }
    
    if (coverPhotoInput) {
        coverPhotoInput.addEventListener('change', function() {
            updateProfile();
        });
    }
}

function setupProfileUpdates() {
    const bioElement = document.querySelector('.user-bio');
    if (bioElement) {
        bioElement.addEventListener('click', editBio);
    }
}

function editBio() {
    const currentBio = document.querySelector('.user-bio').textContent;
    const newBio = prompt('Enter your bio:', currentBio);
    
    if (newBio !== null) {
        updateProfileBio(newBio);
    }
}

function updateProfileBio(bio) {
    fetch('/update_profile', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `bio=${encodeURIComponent(bio)}`
    })
    .then(response => {
        if (response.ok) {
            location.reload();
        }
    })
    .catch(error => {
        console.error('Error updating profile:', error);
    });
}

function updateProfile() {
    const formData = new FormData();
    
    const profilePicInput = document.getElementById('profile-pic-input');
    const coverPhotoInput = document.getElementById('cover-photo-input');
    
    if (profilePicInput.files[0]) {
        formData.append('profile_pic', profilePicInput.files[0]);
    }
    
    if (coverPhotoInput.files[0]) {
        formData.append('cover_photo', coverPhotoInput.files[0]);
    }
    
    fetch('/update_profile', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            location.reload();
        }
    })
    .catch(error => {
        console.error('Error updating profile:', error);
    });
}

function showCreatePost() {
    document.getElementById('create-post-modal').style.display = 'flex';
}

function hideCreatePost() {
    document.getElementById('create-post-modal').style.display = 'none';
}

function createPost() {
    const content = document.getElementById('post-content').value;
    const imageInput = document.getElementById('post-image');
    
    if (!content.trim()) {
        alert('Please enter post content');
        return;
    }
    
    const formData = new FormData();
    formData.append('content', content);
    
    if (imageInput.files[0]) {
        formData.append('image', imageInput.files[0]);
    }
    
    fetch('/create_post', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            location.reload();
        }
    })
    .catch(error => {
        console.error('Error creating post:', error);
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

function searchUsers() {
    const searchTerm = document.getElementById('search-input').value;
    
    if (!searchTerm.trim()) {
        document.getElementById('search-results').style.display = 'none';
        document.getElementById('friends-container').style.display = 'block';
        return;
    }
    
    fetch(`/api/users?search=${encodeURIComponent(searchTerm)}`)
    .then(response => response.json())
    .then(data => {
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';
        
        if (data.users.length === 0) {
            usersList.innerHTML = '<p>No users found</p>';
        } else {
            data.users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                
                let profilePic = user.profile_pic ? 
                    `<img src="/static/uploads/${user.profile_pic}" alt="${user.username}" class="profile-pic-small">` :
                    `<div class="profile-placeholder-small">${user.username[0]}</div>`;
                
                let actionButton = '';
                if (user.friendship_status === 'accepted') {
                    actionButton = '<button class="friend-action btn-secondary" disabled>Friends</button>';
                } else if (user.friendship_status === 'pending') {
                    actionButton = '<button class="friend-action btn-secondary" disabled>Request Sent</button>';
                } else {
                    actionButton = `<button class="friend-action btn-primary" onclick="addFriend(${user.id})">Add Friend</button>`;
                }
                
                userElement.innerHTML = `
                    ${profilePic}
                    <span>${user.username}</span>
                    ${actionButton}
                `;
                
                usersList.appendChild(userElement);
            });
        }
        
        document.getElementById('friends-container').style.display = 'none';
        document.getElementById('search-results').style.display = 'block';
    })
    .catch(error => {
        console.error('Error searching users:', error);
    });
}

function addFriend(userId) {
    fetch(`/add_friend/${userId}`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            searchUsers();
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('Error adding friend:', error);
    });
}

function loadFriends() {
    fetch('/api/friends')
    .then(response => response.json())
    .then(friends => {
        const friendsList = document.getElementById('friends-list');
        const friendsCount = document.getElementById('friends-count');
        
        friendsCount.textContent = `(${friends.length})`;
        
        if (friends.length === 0) {
            friendsList.innerHTML = '<p>No friends yet. Search for users to add friends!</p>';
        } else {
            friendsList.innerHTML = '';
            friends.forEach(friend => {
                const friendElement = document.createElement('div');
                friendElement.className = 'user-item';
                
                let profilePic = friend.profile_pic ? 
                    `<img src="/static/uploads/${friend.profile_pic}" alt="${friend.username}" class="profile-pic-small">` :
                    `<div class="profile-placeholder-small">${friend.username[0]}</div>`;
                
                friendElement.innerHTML = `
                    ${profilePic}
                    <span>${friend.username}</span>
                    ${friend.is_online ? '<div class="online-indicator"></div>' : ''}
                `;
                
                friendElement.addEventListener('click', () => {
                    window.location.href = `/profile/${friend.id}`;
                });
                
                friendsList.appendChild(friendElement);
            });
        }
    })
    .catch(error => {
        console.error('Error loading friends:', error);
    });
}

function showFriends() {
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('friends-container').style.display = 'block';
    loadFriends();
}

function showSettings() {
    alert('Settings feature would be implemented here');
}

function showNotifications() {
    alert('Notifications feature would be implemented here');
}
