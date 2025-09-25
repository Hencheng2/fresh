from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
from PIL import Image
import io
import base64

app = Flask(__name__)
app.config['09da35833ef9cb699888f08d66a0cfb827fb10e53f6c1549'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///sociafam.db'
app.config['UPLOAD_FOLDER'] = 'static/uploads'

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# User model
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    profile_pic = db.Column(db.String(200), default='default_profile.png')
    cover_photo = db.Column(db.String(200), default='default_cover.jpg')
    bio = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_verified = db.Column(db.Boolean, default=False)
    
    # Relationships
    posts = db.relationship('Post', backref='author', lazy=True)
    comments = db.relationship('Comment', backref='author', lazy=True)
    likes = db.relationship('Like', backref='user', lazy=True)
    friends_sent = db.relationship('Friend', foreign_keys='Friend.user_id', backref='sender', lazy=True)
    friends_received = db.relationship('Friend', foreign_keys='Friend.friend_id', backref='receiver', lazy=True)
    messages_sent = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender', lazy=True)
    messages_received = db.relationship('Message', foreign_keys='Message.receiver_id', backref='receiver', lazy=True)

# Post model
class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    image = db.Column(db.String(200))
    video = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_pinned = db.Column(db.Boolean, default=False)
    post_type = db.Column(db.String(20), default='post')  # post, story, reel
    
    # Relationships
    comments = db.relationship('Comment', backref='post', lazy=True, cascade='all, delete-orphan')
    likes = db.relationship('Like', backref='post', lazy=True, cascade='all, delete-orphan')

# Comment model
class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)

# Like model
class Like(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    reaction = db.Column(db.String(10), default='like')  # like, love, haha, wow, sad, angry
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Friend model
class Friend(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    friend_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, accepted, blocked
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_close_friend = db.Column(db.Boolean, default=False)

# Message model
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)

# Notification model
class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    link = db.Column(db.String(200))
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Routes
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('feed'))
    return render_template('index.html')

@app.route('/feed')
@login_required
def feed():
    # Get posts from friends and user
    friends = Friend.query.filter(
        ((Friend.user_id == current_user.id) | (Friend.friend_id == current_user.id)) & 
        (Friend.status == 'accepted')
    ).all()
    
    friend_ids = set()
    for friend in friends:
        if friend.user_id == current_user.id:
            friend_ids.add(friend.friend_id)
        else:
            friend_ids.add(friend.user_id)
    
    friend_ids.add(current_user.id)
    
    posts = Post.query.filter(Post.user_id.in_(friend_ids)).order_by(Post.created_at.desc()).all()
    
    return render_template('index.html', posts=posts)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('feed'))
        else:
            flash('Invalid username or password')
    
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    
    if User.query.filter_by(username=username).first():
        flash('Username already exists')
        return redirect(url_for('index'))
    
    if User.query.filter_by(email=email).first():
        flash('Email already exists')
        return redirect(url_for('index'))
    
    hashed_password = generate_password_hash(password)
    new_user = User(username=username, email=email, password_hash=hashed_password)
    
    db.session.add(new_user)
    db.session.commit()
    
    login_user(new_user)
    return redirect(url_for('feed'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/create_post', methods=['POST'])
@login_required
def create_post():
    content = request.form.get('content')
    post_type = request.form.get('post_type', 'post')
    
    new_post = Post(content=content, user_id=current_user.id, post_type=post_type)
    
    # Handle image upload
    if 'image' in request.files:
        image = request.files['image']
        if image.filename != '':
            filename = f"post_{datetime.now().strftime('%Y%m%d%H%M%S')}_{current_user.id}.jpg"
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image.save(image_path)
            new_post.image = filename
    
    db.session.add(new_post)
    db.session.commit()
    
    return redirect(url_for('feed'))

@app.route('/like_post/<int:post_id>', methods=['POST'])
@login_required
def like_post(post_id):
    post = Post.query.get_or_404(post_id)
    reaction = request.json.get('reaction', 'like')
    
    existing_like = Like.query.filter_by(user_id=current_user.id, post_id=post_id).first()
    
    if existing_like:
        if existing_like.reaction == reaction:
            db.session.delete(existing_like)
        else:
            existing_like.reaction = reaction
    else:
        new_like = Like(user_id=current_user.id, post_id=post_id, reaction=reaction)
        db.session.add(new_like)
    
    db.session.commit()
    
    return jsonify({'success': True, 'likes_count': len(post.likes)})

@app.route('/add_comment/<int:post_id>', methods=['POST'])
@login_required
def add_comment(post_id):
    content = request.form.get('content')
    
    new_comment = Comment(content=content, user_id=current_user.id, post_id=post_id)
    db.session.add(new_comment)
    db.session.commit()
    
    return redirect(url_for('feed'))

@app.route('/add_friend/<int:user_id>', methods=['POST'])
@login_required
def add_friend(user_id):
    if user_id == current_user.id:
        return jsonify({'success': False, 'message': 'Cannot add yourself as a friend'})
    
    existing_friend = Friend.query.filter(
        ((Friend.user_id == current_user.id) & (Friend.friend_id == user_id)) |
        ((Friend.user_id == user_id) & (Friend.friend_id == current_user.id))
    ).first()
    
    if existing_friend:
        if existing_friend.status == 'blocked':
            return jsonify({'success': False, 'message': 'User is blocked'})
        elif existing_friend.status == 'accepted':
            return jsonify({'success': False, 'message': 'Already friends'})
        else:
            return jsonify({'success': False, 'message': 'Friend request already sent'})
    
    new_friend = Friend(user_id=current_user.id, friend_id=user_id)
    db.session.add(new_friend)
    db.session.commit()
    
    # Create notification for the friend
    notification = Notification(
        user_id=user_id,
        content=f"{current_user.username} sent you a friend request",
        link=f"/profile/{current_user.id}"
    )
    db.session.add(notification)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Friend request sent'})

@app.route('/profile/<int:user_id>')
@login_required
def profile(user_id):
    user = User.query.get_or_404(user_id)
    posts = Post.query.filter_by(user_id=user_id).order_by(Post.created_at.desc()).all()
    
    # Check friendship status
    friendship = Friend.query.filter(
        ((Friend.user_id == current_user.id) & (Friend.friend_id == user_id)) |
        ((Friend.user_id == user_id) & (Friend.friend_id == current_user.id))
    ).first()
    
    return render_template('index.html', profile_user=user, profile_posts=posts, friendship=friendship)

# API endpoints for AJAX
@app.route('/api/posts')
@login_required
def api_posts():
    page = request.args.get('page', 1, type=int)
    per_page = 10
    
    friends = Friend.query.filter(
        ((Friend.user_id == current_user.id) | (Friend.friend_id == current_user.id)) & 
        (Friend.status == 'accepted')
    ).all()
    
    friend_ids = set()
    for friend in friends:
        if friend.user_id == current_user.id:
            friend_ids.add(friend.friend_id)
        else:
            friend_ids.add(friend.user_id)
    
    friend_ids.add(current_user.id)
    
    posts = Post.query.filter(Post.user_id.in_(friend_ids)).order_by(Post.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False)
    
    posts_data = []
    for post in posts.items:
        post_data = {
            'id': post.id,
            'content': post.content,
            'image': post.image,
            'video': post.video,
            'created_at': post.created_at.strftime('%Y-%m-%d %H:%M'),
            'author': {
                'id': post.author.id,
                'username': post.author.username,
                'profile_pic': post.author.profile_pic
            },
            'likes_count': len(post.likes),
            'comments_count': len(post.comments),
            'user_liked': any(like.user_id == current_user.id for like in post.likes),
            'user_reaction': next((like.reaction for like in post.likes if like.user_id == current_user.id), None)
        }
        posts_data.append(post_data)
    
    return jsonify({
        'posts': posts_data,
        'has_next': posts.has_next,
        'has_prev': posts.has_prev,
        'page': page
    })

@app.route('/api/notifications')
@login_required
def api_notifications():
    notifications = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.created_at.desc()).limit(10).all()
    
    notifications_data = []
    for notification in notifications:
        notifications_data.append({
            'id': notification.id,
            'content': notification.content,
            'link': notification.link,
            'is_read': notification.is_read,
            'created_at': notification.created_at.strftime('%Y-%m-%d %H:%M')
        })
    
    return jsonify(notifications_data)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
