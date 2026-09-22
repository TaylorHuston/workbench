import sqlite3

import click
from flask import current_app, g
# g is a special object that is unique for each request, used to store data that might be accessed by multiple functions during the request. Connection is stored and resued.
# current_app is a special object that points to the flask application handling the request. Since you used an application factory, there is no application object when writing the rest of your code. get_db will be called when the application has been created and is handling a request, so current_app can be used.

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect( # sqlite3.connect() establishes a connection to the file pointed at by the DATABASE configuration key.
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row # Tells the connection to return rows that behave like dicts. This allows accessing the columns by name.

        return g.db
    
def close_db(e=None): # close_db checks if a connection was created by checking if g.db was set, and closes it if it exists.
    db = g.pop('db', None)

    if db is not None:
        db.close()

def init_db():
    db = get_db() # get_db returns a database connection, which is used to execute the commands read from the file.

    with current_app.open_resource('schema.sql') as f: # open_resource Opens a file relative to the flaskr package, useful as you won't always know where the location is when deploying later
        db.executescript(f.read().decode('utf8'))

@click.command('init-db') # click.command() defines a command line command
def init_db_command():
    """ Clear the existing data and create new tables. """
    init_db()
    click.echo('Initialized the database.')

# The close_db and init_db_command functions need to be registered with the application
def init_app(app):
    app.teardown_appcontext(close_db) # app.teardown_appcontext() tells Flask to call that function when cleaning up after returning the response.
    app.cli.add_command(init_db_command) # app.cli.add_command() adds a new command that can be called with the flask command.
