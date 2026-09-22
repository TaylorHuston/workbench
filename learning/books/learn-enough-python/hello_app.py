from datetime import datetime

from flask import Flask

from LearnEnoughPython.day import dayname, greeting

app = Flask(__name__)

@app.route("/")
def hello_world():
  return greeting(datetime.now())
