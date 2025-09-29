from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
import secrets

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', '09da35833ef9cb699888f08d66a0cfb827fb10e53f6c1549')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///sociafam.db').replace('postgres://', 'postgresql://')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    profile_pic = db.Column(db.String(200))
    cover_photo = db.Column(db.String(200))
    bio = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_verified = db.Column(db.Boolean, default=False)
    
    posts = db.relationship('Post', backref='author', lazy=True)
    comments = db.relationship('Comment', backref='author', lazy=True)
    likes = db.relationship('Like', backref='user', lazy=True)
    friends_sent = db.relationship('Friend', foreign_keys='Friend.user_id', backref='sender', lazy=True)
    friends_received = db.relationship('Friend', foreign_keys='Friend.friend_id', backref='receiver', lazy=True)

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    image = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_pinned = db.Column(db.Boolean, default=False)
    
    comments = db.relationship('Comment', backref='post', lazy=True, cascade='all, delete-orphan')
    likes = db.relationship('Like', backref='post', lazy=True, cascade='all, delete-orphan')

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)

class Like(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    reaction = db.Column(db.String(10), default='like')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Friend(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    friend_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_close_friend = db.Column(db.Boolean, default=False)

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

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('feed'))
    return render_template('index.html')

@app.route('/feed')
@login_required
def feed():
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
    return render_template('feed.html', posts=posts)

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
    
    if not content or content.strip() == '':
        flash('Post content cannot be empty')
        return redirect(request.referrer or url_for('feed'))
    
    new_post = Post(content=content.strip(), user_id=current_user.id)
    
    if 'image' in request.files:
        image = request.files['image']
        if image.filename != '':
            allowed_extensions = {'jpg', 'jpeg', 'png', 'gif'}
            if '.' in image.filename and image.filename.rsplit('.', 1)[1].lower() in allowed_extensions:
                random_hex = secrets.token_hex(8)
                filename = f"post_{random_hex}.{image.filename.rsplit('.', 1)[1].lower()}"
                image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                image.save(image_path)
                new_post.image = filename
    
    db.session.add(new_post)
    db.session.commit()
    flash('Post created successfully!')
    return redirect(request.referrer or url_for('feed'))

@app.route('/update_profile', methods=['POST'])
@login_required
def update_profile():
    bio = request.form.get('bio', '')
    
    if 'profile_pic' in request.files:
        image = request.files['profile_pic']
        if image.filename != '':
            allowed_extensions = {'jpg', 'jpeg', 'png', 'gif'}
            if '.' in image.filename and image.filename.rsplit('.', 1)[1].lower() in allowed_extensions:
                random_hex = secrets.token_hex(8)
                filename = f"profile_{random_hex}.{image.filename.rsplit('.', 1)[1].lower()}"
                image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                image.save(image_path)
                
                if current_user.profile_pic:
                    old_path = os.path.join(app.config['UPLOAD_FOLDER'], current_user.profile_pic)
                    if os.path.exists(old_path):
                        os.remove(old_path)
                
                current_user.profile_pic = filename
    
    if 'cover_photo' in request.files:
        image = request.files['cover_photo']
        if image.filename != '':
            allowed_extensions = {'jpg', 'jpeg', 'png', 'gif'}
            if '.' in image.filename and image.filename.rsplit('.', 1)[1].lower() in allowed_extensions:
                random_hex = secrets.token_hex(8)
                filename = f"cover_{random_hex}.{image.filename.rsplit('.', 1)[1].lower()}"
                image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                image.save(image_path)
                
                if current_user.cover_photo:
                    old_path = os.path.join(app.config['UPLOAD_FOLDER'], current_user.cover_photo)
                    if os.path.exists(old_path):
                        os.remove(old_path)
                
                current_user.cover_photo = filename
    
    current_user.bio = bio.strip()
    db.session.commit()
    flash('Profile updated successfully!')
    return redirect(url_for('my_profile'))

@app.route('/like_post/<int:post_id>', methods=['POST'])
@login_required
def like_post(post_id):
    post = Post.query.get_or_404(post_id)
    reaction = request.json.get('reaction', 'like')
    
    existing_like = Like.query.filter_by(user_id=current_user.id, post_id=post_id).first()
    
    if existing_like:
        if existing_like.reaction == reaction:
            db.session.delete(existing_like)
            liked = False
        else:
            existing_like.reaction = reaction
            liked = True
    else:
        new_like = Like(user_id=current_user.id, post_id=post_id, reaction=reaction)
        db.session.add(new_like)
        liked = True
    
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'likes_count': len(post.likes),
        'liked': liked,
        'reaction': reaction if liked else None
    })

@app.route('/add_comment/<int:post_id>', methods=['POST'])
@login_required
def add_comment(post_id):
    content = request.form.get('content')
    
    if not content or content.strip() == '':
        flash('Comment cannot be empty')
        return redirect(request.referrer or url_for('feed'))
    
    new_comment = Comment(content=content.strip(), user_id=current_user.id, post_id=post_id)
    db.session.add(new_comment)
    db.session.commit()
    
    return redirect(request.referrer or url_for('feed'))

@app.route('/add_friend/<int:user_id>', methods=['POST'])
@login_required
def add_friend(user_id):
    if user_id == current_user.id:
        return jsonify({'success': False, 'message': 'Cannot add yourself as a friend'})
    
    target_user = User.query.get_or_404(user_id)
    
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
    
    notification = Notification(
        user_id=user_id,
        content=f"{current_user.username} sent you a friend request",
        link=f"/profile/{current_user.id}"
    )
    db.session.add(notification)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Friend request sent'})

@app.route('/accept_friend/<int:friend_id>', methods=['POST'])
@login_required
def accept_friend(friend_id):
    friendship = Friend.query.get_or_404(friend_id)
    
    if friendship.friend_id != current_user.id:
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    friendship.status = 'accepted'
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Friend request accepted'})

@app.route('/my_profile')
@login_required
def my_profile():
    user = current_user
    posts = Post.query.filter_by(user_id=user.id).order_by(Post.created_at.desc()).all()
    
    friends = Friend.query.filter(
        ((Friend.user_id == user.id) | (Friend.friend_id == user.id)) & 
        (Friend.status == 'accepted')
    ).all()
    
    friend_ids = set()
    for friend in friends:
        if friend.user_id == user.id:
            friend_ids.add(friend.friend_id)
        else:
            friend_ids.add(friend.user_id)
    
    friends_count = len(friend_ids)
    
    return render_template('profile.html', 
                         profile_user=user, 
                         profile_posts=posts, 
                         friends_count=friends_count,
                         is_own_profile=True)

@app.route('/profile/<int:user_id>')
@login_required
def profile(user_id):
    user = User.query.get_or_404(user_id)
    posts = Post.query.filter_by(user_id=user_id).order_by(Post.created_at.desc()).all()
    
    friendship = Friend.query.filter(
        ((Friend.user_id == current_user.id) & (Friend.friend_id == user_id)) |
        ((Friend.user_id == user_id) & (Friend.friend_id == current_user.id))
    ).first()
    
    friends = Friend.query.filter(
        ((Friend.user_id == user_id) | (Friend.friend_id == user_id)) & 
        (Friend.status == 'accepted')
    ).all()
    
    friend_ids = set()
    for friend in friends:
        if friend.user_id == user_id:
            friend_ids.add(friend.friend_id)
        else:
            friend_ids.add(friend.user_id)
    
    friends_count = len(friend_ids)
    
    return render_template('profile.html', 
                         profile_user=user, 
                         profile_posts=posts, 
                         friendship=friendship,
                         friends_count=friends_count,
                         is_own_profile=False)

@app.route('/friends')
@login_required
def friends():
    friends = Friend.query.filter(
        ((Friend.user_id == current_user.id) | (Friend.friend_id == current_user.id)) & 
        (Friend.status == 'accepted')
    ).all()
    
    friend_ids = set()
    friends_list = []
    for friend in friends:
        if friend.user_id == current_user.id:
            friend_user = User.query.get(friend.friend_id)
            friend_ids.add(friend.friend_id)
        else:
            friend_user = User.query.get(friend.user_id)
            friend_ids.add(friend.user_id)
        
        if friend_user:
            friends_list.append(friend_user)
    
    # Get pending friend requests
    pending_requests = Friend.query.filter_by(friend_id=current_user.id, status='pending').all()
    pending_users = [User.query.get(request.user_id) for request in pending_requests]
    
    # Get friend suggestions (users who are not friends)
    all_users = User.query.filter(User.id != current_user.id).all()
    suggestions = [user for user in all_users if user.id not in friend_ids]
    
    return render_template('friends.html', 
                         friends=friends_list, 
                         pending_requests=pending_users,
                         suggestions=suggestions[:10])

@app.route('/api/users')
@login_required
def api_users():
    search = request.args.get('search', '')
    page = request.args.get('page', 1, type=int)
    per_page = 10
    
    if search:
        users = User.query.filter(User.username.ilike(f'%{search}%')).paginate(
            page=page, per_page=per_page, error_out=False)
    else:
        users = User.query.paginate(page=page, per_page=per_page, error_out=False)
    
    users_data = []
    for user in users.items:
        if user.id == current_user.id:
            continue
            
        friendship = Friend.query.filter(
            ((Friend.user_id == current_user.id) & (Friend.friend_id == user.id)) |
            ((Friend.user_id == user.id) & (Friend.friend_id == current_user.id))
        ).first()
        
        users_data.append({
            'id': user.id,
            'username': user.username,
            'profile_pic': user.profile_pic,
            'friendship_status': friendship.status if friendship else 'none'
        })
    
    return jsonify({
        'users': users_data,
        'has_next': users.has_next,
        'page': page
    })

@app.route('/api/friends')
@login_required
def api_friends():
    friends = Friend.query.filter(
        ((Friend.user_id == current_user.id) | (Friend.friend_id == current_user.id)) & 
        (Friend.status == 'accepted')
    ).all()
    
    friend_ids = set()
    friends_data = []
    for friend in friends:
        if friend.user_id == current_user.id:
            friend_user = User.query.get(friend.friend_id)
            friend_ids.add(friend.friend_id)
        else:
            friend_user = User.query.get(friend.user_id)
            friend_ids.add(friend.user_id)
        
        if friend_user:
            friends_data.append({
                'id': friend_user.id,
                'username': friend_user.username,
                'profile_pic': friend_user.profile_pic,
                'is_online': False
            })
    
    return jsonify(friends_data)

@app.route('/static/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
