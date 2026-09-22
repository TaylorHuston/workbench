import functools
from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)
from werkzeug.security import check_password_hash, generate_password_hash

from flaskr.db import get_db # import the get_db function defined in db.py

bp = Blueprint('auth', __name__, url_prefix='/auth') # Create a Blueprint named auth
               
@bp.route('/register', methods=('GET', 'POST')) # When Flask receives a request to /auth/register, it will call the register view and use the return value as the response.
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        error = None

        if not username:
            error = 'Username is required.'
        elif not password:
            error = 'Password is required.'

        if error is None:
            try:
                db.execute( # execute takes a SQL query with ? placeholders for any user input, and a tuple of values to replace the placeholders with.
                    'INSERT INTO user (username, password) VALUES (?, ?)',
                    (username, generate_password_hash(password))
                )
                db.commit()
            except db.IntegrityError: # IntegrityError is raised when inserting a duplicate entry, which should be impossible given the username column’s UNIQUE constraint. If that happens, the error is shown to the user.
                error = f"User {username} is already registered."
            else:
                return redirect(url_for("auth.login"))
            
        flash(error)


    return render_template('auth/register.html')

@bp.route('/login', methods=('GET', 'POST'))
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        error = None
        user = db.execute( 
            'SELECT * FROM user WHERE username = ?', (username,)
        ).fetchone() # fetchone() returns one row from the query. If the query returned no results, it returns None.

        if user is None:
            error = 'Incorrect username.'
        elif not check_password_hash(user['password'], password):
            error = 'Incorrect password.'

        # Session is a dict that stores data across requests. When validation succeeds, the user’s id is stored in a new session. 
        # The data is stored in a cookie that is sent to the browser, and the browser then sends it back with subsequent requests. Flask securely signs the data so that it can’t be tampered with.
        if error is None:
            session.clear() 
            session['user_id'] = user['id']
            return redirect(url_for('index'))

        flash(error)

    return render_template('auth/login.html')

# bp.before_app_request() registers a function that runs before the view function, no matter what URL is requested. 
@bp.before_app_request
def load_logged_in_user():
    user_id = session.get('user_id')

    if user_id is None:
        g.user = None
    else:
        g.user = get_db().execute(
            'SELECT * FROM user WHERE id = ?', (user_id,)
        ).fetchone()

@bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index')) # After logging out, load_logged_in_user won’t load a user on subsequent requests.

# This decorator returns a new view function that wraps the original view it’s applied to.
def login_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if g.user is None:
            return redirect(urk_for('auth.login'))
        
        return view(**kwargs)
    
    return wrapped_view