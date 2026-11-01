import os
import pytest
import requests
import uuid
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

BASE_URL = "http://localhost:8001"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="session")
def db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


def _seed_user(db, email, role, user_id):
    # Deterministic token so parallel xdist workers both produce the same seed (idempotent).
    token = f"test_token_fixed_{role}"
    db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "email": email,
            "name": f"TEST {role}",
            "picture": None,
            "role": role,
            "phone": None,
            "birth_date": None,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    db.user_sessions.update_one(
        {"session_token": token},
        {"$set": {
            "session_token": token,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        }},
        upsert=True,
    )
    return token


@pytest.fixture(scope="session")
def admin_token(db):
    return _seed_user(db, "admin@drjocelio.com.br", "admin", "user_admin_test")


@pytest.fixture(scope="session")
def patient_token(db):
    return _seed_user(db, "patient@test.com", "patient", "user_patient_test")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def patient_headers(patient_token):
    return {"Authorization": f"Bearer {patient_token}", "Content-Type": "application/json"}
