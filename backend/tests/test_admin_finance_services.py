# Admin finance + procedures (services) CRUD tests — iteration 2
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests

from conftest import BASE_URL, ADMIN_PASSWORD, PATIENT_EMAIL, PATIENT_PASSWORD

TZ = ZoneInfo("America/Sao_Paulo")


def _fwd():
    return {"X-Forwarded-For": f"10.9.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"}


@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{BASE_URL}/api/auth/admin-login", json={"password": ADMIN_PASSWORD}, headers=_fwd())
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def patient_h():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": PATIENT_EMAIL, "password": PATIENT_PASSWORD}, headers=_fwd())
    if r.status_code != 200:
        pytest.skip(f"patient login failed {r.status_code}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def created():
    ids = []
    yield ids
    # cleanup: soft-remove all TEST_ services
    r = requests.post(f"{BASE_URL}/api/auth/admin-login", json={"password": ADMIN_PASSWORD}, headers=_fwd())
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    for sid in ids:
        requests.delete(f"{BASE_URL}/api/admin/services/{sid}", headers=h)


def _next_slot(h, dentist_id, offset_days=1):
    d = datetime.now(TZ).date()
    for i in range(offset_days, offset_days + 20):
        day = d + timedelta(days=i)
        if day.weekday() == 6:
            continue
        r = requests.get(f"{BASE_URL}/api/appointments/available-slots", params={"date": str(day), "dentist_id": dentist_id}, headers=h)
        if r.status_code == 200 and r.json()["slots"]:
            return str(day), r.json()["slots"][-1]
    pytest.fail("no slot found")


# --- Finance auth/validation
class TestFinanceAuth:
    def test_no_token_401(self):
        assert requests.get(f"{BASE_URL}/api/admin/finance").status_code == 401

    def test_patient_403(self, patient_h):
        assert requests.get(f"{BASE_URL}/api/admin/finance", headers=patient_h).status_code == 403

    def test_bad_period_400(self, admin_h):
        assert requests.get(f"{BASE_URL}/api/admin/finance?period=foo", headers=admin_h).status_code == 400

    @pytest.mark.parametrize("p", ["month", "last_month", "year", "all"])
    def test_periods_structure(self, admin_h, p):
        r = requests.get(f"{BASE_URL}/api/admin/finance?period={p}", headers=admin_h)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_revenue", "completed_count", "average_ticket", "expected_revenue", "by_service"]:
            assert k in d
        assert abs(sum(x["revenue"] for x in d["by_service"]) - d["total_revenue"]) < 0.01
        if p == "all":
            assert d["start"] is None


# --- Services CRUD
class TestServicesAdmin:
    def test_auth(self, patient_h):
        assert requests.get(f"{BASE_URL}/api/admin/services").status_code == 401
        assert requests.get(f"{BASE_URL}/api/admin/services", headers=patient_h).status_code == 403
        assert requests.post(f"{BASE_URL}/api/admin/services", headers=patient_h, json={"name": "TEST_x", "duration_min": 30, "price": 1}).status_code == 403

    @pytest.mark.parametrize("payload", [
        {"name": "A", "duration_min": 30, "price": 10},
        {"name": "TEST_dur", "duration_min": 4, "price": 10},
        {"name": "TEST_dur", "duration_min": 481, "price": 10},
        {"name": "TEST_neg", "duration_min": 30, "price": -1},
    ])
    def test_validation_422(self, admin_h, payload):
        assert requests.post(f"{BASE_URL}/api/admin/services", headers=admin_h, json=payload).status_code == 422

    def test_full_lifecycle_and_frozen_price(self, admin_h, patient_h, created):
        # create
        r = requests.post(f"{BASE_URL}/api/admin/services", headers=admin_h, json={
            "name": f"TEST_Proc_{uuid.uuid4().hex[:5]}", "description": "teste", "duration_min": 30, "price": 100.0, "icon": "medkit-outline"})
        assert r.status_code == 201, r.text
        svc = r.json(); sid = svc["id"]; created.append(sid)
        assert svc["active"] is True and svc["price"] == 100.0
        pub = requests.get(f"{BASE_URL}/api/services").json()
        assert any(s["id"] == sid for s in pub)

        # book as patient
        dentist_id = requests.get(f"{BASE_URL}/api/dentists").json()[0]["id"]
        date, time = _next_slot(patient_h, dentist_id)
        r = requests.post(f"{BASE_URL}/api/appointments", headers=patient_h, json={"service_id": sid, "dentist_id": dentist_id, "date": date, "time": time})
        assert r.status_code == 200, r.text
        appt = r.json(); assert appt["price"] == 100.0

        before_all = requests.get(f"{BASE_URL}/api/admin/finance?period=all", headers=admin_h).json()
        # complete
        r = requests.put(f"{BASE_URL}/api/admin/appointments/{appt['id']}", headers=admin_h, json={"status": "completed"})
        assert r.status_code == 200 and r.json()["status"] == "completed"

        # change price -> 999
        r = requests.put(f"{BASE_URL}/api/admin/services/{sid}", headers=admin_h, json={"price": 999.0})
        assert r.status_code == 200 and r.json()["price"] == 999.0
        assert next(s for s in requests.get(f"{BASE_URL}/api/services").json() if s["id"] == sid)["price"] == 999.0

        after_all = requests.get(f"{BASE_URL}/api/admin/finance?period=all", headers=admin_h).json()
        assert round(after_all["total_revenue"] - before_all["total_revenue"], 2) == 100.0, "frozen price not used"
        row = next(x for x in after_all["by_service"] if x["service_name"] == svc["name"])
        assert row["revenue"] == 100.0 and row["count"] == 1

        # soft delete
        r = requests.delete(f"{BASE_URL}/api/admin/services/{sid}", headers=admin_h)
        assert r.status_code == 200
        assert not any(s["id"] == sid for s in requests.get(f"{BASE_URL}/api/services").json())
        adm = requests.get(f"{BASE_URL}/api/admin/services", headers=admin_h).json()
        assert next(s for s in adm if s["id"] == sid)["active"] is False
        date2, time2 = _next_slot(patient_h, dentist_id, 2)
        r = requests.post(f"{BASE_URL}/api/appointments", headers=patient_h, json={"service_id": sid, "dentist_id": dentist_id, "date": date2, "time": time2})
        assert r.status_code == 400
        # finance history intact
        hist = requests.get(f"{BASE_URL}/api/admin/finance?period=all", headers=admin_h).json()
        assert any(x["service_name"] == svc["name"] for x in hist["by_service"])

        # restore
        r = requests.put(f"{BASE_URL}/api/admin/services/{sid}", headers=admin_h, json={"active": True})
        assert r.status_code == 200 and r.json()["active"] is True
        assert any(s["id"] == sid for s in requests.get(f"{BASE_URL}/api/services").json())

    def test_completed_future_appt_in_month_period(self, admin_h, patient_h, created):
        """Completing a booked (future-dated) appointment should be reflected in 'month' finance if in current month."""
        r = requests.post(f"{BASE_URL}/api/admin/services", headers=admin_h, json={"name": f"TEST_M_{uuid.uuid4().hex[:5]}", "duration_min": 30, "price": 50.0})
        sid = r.json()["id"]; created.append(sid)
        dentist_id = requests.get(f"{BASE_URL}/api/dentists").json()[0]["id"]
        date, time = _next_slot(patient_h, dentist_id, 1)
        if date[:7] != datetime.now(TZ).strftime("%Y-%m"):
            pytest.skip("next slot not in current month")
        appt = requests.post(f"{BASE_URL}/api/appointments", headers=patient_h, json={"service_id": sid, "dentist_id": dentist_id, "date": date, "time": time}).json()
        before = requests.get(f"{BASE_URL}/api/admin/finance?period=month", headers=admin_h).json()["total_revenue"]
        requests.put(f"{BASE_URL}/api/admin/appointments/{appt['id']}", headers=admin_h, json={"status": "completed"})
        after = requests.get(f"{BASE_URL}/api/admin/finance?period=month", headers=admin_h).json()["total_revenue"]
        assert round(after - before, 2) == 50.0, f"month revenue not updated: before={before} after={after} (appt date {date})"

    def test_update_delete_404(self, admin_h):
        assert requests.put(f"{BASE_URL}/api/admin/services/nope", headers=admin_h, json={"price": 1}).status_code == 404
        assert requests.delete(f"{BASE_URL}/api/admin/services/nope", headers=admin_h).status_code == 404
