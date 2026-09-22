from flask import Flask, jsonify, render_template, request
from database import load_jobs, add_application_to_db
import os

app = Flask(__name__)

app.config['DB_CONNECTION_STR'] = os.environ.get('DB_CONNECTION_STR')

# JOBS = [
#     {
#         'id': 1,
#         'title': 'Software Engineer',
#         'location': 'San Francisco, CA',
#         'salary': '$100,000 - $150,000',
#     },
#     {
#         'id': 2,
#         'title': 'Data Scientist',
#         'location': 'New York, NY',
#         'salary': '$120,000 - $180,000',
#     },
#     {
#         'id': 3,
#         'title': 'Product Manager',
#         'location': 'Seattle, WA',
#         'salary': '$130,000 - $200,000',
#     },
#     {
#         'id': 4,
#         'title': 'DevOps Engineer',
#         'location': 'Austin, TX',
#     },
# ]


@app.route("/")
def hello_world():
    all_jobs = load_jobs()
    return render_template('home.html', 
                           jobs=all_jobs,
                           company_name='Jovian')

@app.route("/api/jobs")
def list_jobs():
    all_jobs = load_jobs()
    return jsonify(all_jobs)

@app.route("/job/<id>")
def show_job(id):
    all_jobs = load_jobs()
    job = next((job for job in all_jobs if job['id'] == int(id)), None)
    if job:
        return render_template('jobpage.html', job=job)
    else:
        return "Job not found", 404
    
@app.post("/job/<id>/apply")
def apply_to_jobs(id):
    data = request.form
    add_application_to_db(id, data)
    return render_template('application_submitted.html', application=data)

# If ran from the command line with python3 app.py
if __name__ == "__main__":
    app.run(host='0.0.0.0', debug=True)