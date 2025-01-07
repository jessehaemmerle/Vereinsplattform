#!/usr/bin/env python3
"""
A management script for handling database migrations with Flask-Migrate.
Usage:
    python manage.py db init
    python manage.py db migrate -m "Initial migration"
    python manage.py db upgrade
"""

from flask_script import Manager
from flask_migrate import Migrate, MigrateCommand
from app import create_app, db  # Import your factory function and db object

# 1. Create the application and initialize it
app = create_app()

# 2. Set up Migrate and Manager
migrate = Migrate(app, db)
manager = Manager(app)

# 3. Add the 'db' command to handle migrations
manager.add_command('db', MigrateCommand)

if __name__ == '__main__':
    manager.run()
