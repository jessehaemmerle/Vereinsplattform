import os
from PyInstaller.__main__ import run

# Basisverzeichnis des Projekts
base_dir = os.path.abspath(os.getcwd())

# Pfade
main_script = os.path.join(base_dir, 'app.py')
templates_dir = os.path.join(base_dir, 'templates')
static_dir = os.path.join(base_dir, 'static')
models_path = os.path.join(base_dir, 'models.py')
forms_path = os.path.join(base_dir, 'forms.py')
services_path = os.path.join(base_dir, 'services.py')

# PyInstaller-Befehle und Optionen
options = [
    main_script,                # Hauptprogramm
    '--onefile',                # Eine einzige ausführbare Datei erstellen
    '--noconfirm',              # Kein Bestätigungsdialog
    f'--add-data={templates_dir}{os.pathsep}templates', # Vorlagen
    f'--add-data={static_dir}{os.pathsep}static',       # Statische Dateien
    f'--add-data={models_path}{os.pathsep}.',           # models.py
    f'--add-data={forms_path}{os.pathsep}.',            # forms.py
    f'--add-data={services_path}{os.pathsep}.',         # services.py
    '--collect-all=pysqlite3', 
    '--collect-all=MySQLdb',
    '--collect-all=psycopg2',
    '--hidden-import=pysqlite2',                        # Hidden Import: pysqlite2
    '--hidden-import=MySQLdb',                          # Hidden Import: MySQLdb
    '--hidden-import=psycopg2',                         # Hidden Import: psycopg2
    '--name=MemberWorks_Beta_0_4_5', # Name der ausführbaren Datei
    '--log-level=DEBUG'
]

# PyInstaller ausführen
run(options)
