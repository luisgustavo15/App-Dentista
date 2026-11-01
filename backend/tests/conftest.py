import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")
BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
ADMIN_PASSWORD = "Jocelio#4821"
PATIENT_EMAIL = "maria@test.com"
PATIENT_PASSWORD = "senha123"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def patient_auth(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": PATIENT_EMAIL, "password": PATIENT_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"patient login failed {r.status_code} {r.text}")
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}"}, d["user"]


@pytest.fixture(scope="session")
def admin_auth(api):
    r = api.post(f"{BASE_URL}/api/auth/admin-login", json={"password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code} {r.text}")
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}"}, d["user"]


@pytest.fixture
def uniq():
    return uuid.uuid4().hex[:8]
