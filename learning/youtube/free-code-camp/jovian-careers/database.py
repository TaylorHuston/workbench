from sqlalchemy import create_engine, text
import os

def load_jobs():
    DB_CONNECTION_STR = os.environ.get('DB_CONNECTION_STR')

    db_connection_string = DB_CONNECTION_STR

    engine = create_engine(db_connection_string,
                        connect_args={
                            "ssl": {
                                "ca": "/etc/ssl/certs/ca-certificates.crt"
                            }
                        })

    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM jobs"))

        jobs = [dict(row) for row in result.all()]
    return jobs

def add_application_to_db(job_id, data):
    DB_CONNECTION_STR = os.environ.get('DB_CONNECTION_STR')

    db_connection_string = DB_CONNECTION_STR

    engine = create_engine(db_connection_string,
                        connect_args={
                            "ssl": {
                                "ca": "/etc/ssl/certs/ca-certificates.crt"
                            }
                        })
    
    with engine.connect() as conn:
        query = text("INSERT INTO applications (job_id, full_name, email, experience, education) VALUES (:job_id, :full_name, :email, :experience, :education)")

        conn.execute(query, job_id=job_id, full_name=data['name'], email=data['email'], experience=data['experience'], education=data['education'])