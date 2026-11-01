import requests
from datetime import datetime, timedelta


# ----- Public catalog endpoints -----
class TestCatalog:
    def test_services_seeded_8(self, api, base_url):
        r = api.get(f"{base_url}/api/services")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 8
        names = {s["name"] for s in data}
        assert "Limpeza e Profilaxia" in names
        assert all({"id", "name", "duration_min", "price", "icon"} <= set(s) for s in data)

    def test_dentists_seeded_3(self, api, base_url):
        r = api.get(f"{base_url}/api/dentists")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 3
        assert any("Jocélio" in d["name"] for d in data)

    def test_gallery_seeded_3(self, api, base_url):
        r = api.get(f"{base_url}/api/gallery")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 3
        assert all(d.get("before_image") and d.get("after_image") for d in data)

    def test_clinic_info(self, api, base_url):
        r = api.get(f"{base_url}/api/clinic")
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == "contato@drjocelio.com.br"
        assert "lat" in d and "lng" in d


# ----- Auth endpoints -----
class TestAuth:
    def test_session_invalid_returns_401(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/session", json={"session_id": "invalid-xxx"})
        assert r.status_code == 401

    def test_me_without_token_401(self, api, base_url):
        r = requests.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_bad_token_401(self, api, base_url):
        r = requests.get(f"{base_url}/api/auth/me", headers={"Authorization": "Bearer notatoken"})
        assert r.status_code == 401

    def test_me_patient_ok(self, base_url, patient_headers):
        r = requests.get(f"{base_url}/api/auth/me", headers=patient_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == "patient@test.com"
        assert d["role"] == "patient"

    def test_me_admin_ok(self, base_url, admin_headers):
        r = requests.get(f"{base_url}/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_profile_update(self, base_url, patient_headers):
        r = requests.put(
            f"{base_url}/api/auth/profile",
            headers=patient_headers,
            json={"phone": "+55 11 90000-0000", "birth_date": "1990-05-15"},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["phone"] == "+55 11 90000-0000"
        assert d["birth_date"] == "1990-05-15"
        # Verify persistence via GET /me
        r2 = requests.get(f"{base_url}/api/auth/me", headers=patient_headers)
        assert r2.json()["phone"] == "+55 11 90000-0000"


# ----- Appointments (patient flow) -----
class TestAppointments:
    @classmethod
    def _get_ids(cls, api, base_url):
        svc = api.get(f"{base_url}/api/services").json()[0]["id"]
        den = api.get(f"{base_url}/api/dentists").json()[0]["id"]
        return svc, den

    def test_available_slots_requires_auth(self, api, base_url):
        r = api.get(f"{base_url}/api/appointments/available-slots",
                    params={"date": "2026-02-10", "dentist_id": "x"})
        assert r.status_code == 401

    def test_available_slots_ok(self, api, base_url, patient_headers):
        _, den = self._get_ids(api, base_url)
        r = requests.get(
            f"{base_url}/api/appointments/available-slots",
            headers=patient_headers,
            params={"date": "2026-02-10", "dentist_id": den},
        )
        assert r.status_code == 200
        slots = r.json()["slots"]
        assert isinstance(slots, list)
        assert "09:00" in slots

    def test_create_appointment_and_double_booking(self, api, base_url, patient_headers, db):
        svc, den = self._get_ids(api, base_url)
        # cleanup
        db.appointments.delete_many({"user_id": "user_patient_test"})

        future_date = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
        payload = {"service_id": svc, "dentist_id": den, "date": future_date,
                   "time": "10:00", "notes": "TEST appt"}
        r = requests.post(f"{base_url}/api/appointments", headers=patient_headers, json=payload)
        assert r.status_code == 200, r.text
        appt = r.json()
        assert appt["status"] == "pending"
        assert appt["user_id"] == "user_patient_test"
        appt_id = appt["id"]

        # Double booking -> 409
        r2 = requests.post(f"{base_url}/api/appointments", headers=patient_headers, json=payload)
        assert r2.status_code == 409

        # Slot now excluded
        r3 = requests.get(
            f"{base_url}/api/appointments/available-slots",
            headers=patient_headers,
            params={"date": future_date, "dentist_id": den},
        )
        assert "10:00" not in r3.json()["slots"]

        # Mine lists it
        r4 = requests.get(f"{base_url}/api/appointments/mine", headers=patient_headers)
        assert r4.status_code == 200
        assert any(a["id"] == appt_id for a in r4.json())

        # Invalid service/dentist -> 400
        bad = requests.post(f"{base_url}/api/appointments", headers=patient_headers,
                            json={**payload, "service_id": "nope", "time": "11:00"})
        assert bad.status_code == 400

    def test_cancel_own_appointment(self, api, base_url, patient_headers, db):
        svc, den = self._get_ids(api, base_url)
        future_date = (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d")
        r = requests.post(f"{base_url}/api/appointments", headers=patient_headers,
                          json={"service_id": svc, "dentist_id": den,
                                "date": future_date, "time": "14:00"})
        assert r.status_code == 200
        appt_id = r.json()["id"]
        r2 = requests.delete(f"{base_url}/api/appointments/{appt_id}", headers=patient_headers)
        assert r2.status_code == 200
        # verify persisted via mine
        mine = requests.get(f"{base_url}/api/appointments/mine", headers=patient_headers).json()
        cancelled = [a for a in mine if a["id"] == appt_id][0]
        assert cancelled["status"] == "cancelled"

    def test_mine_requires_auth(self, api, base_url):
        r = api.get(f"{base_url}/api/appointments/mine")
        assert r.status_code == 401


# ----- Admin endpoints -----
class TestAdmin:
    def test_admin_appointments_forbidden_for_patient(self, base_url, patient_headers):
        r = requests.get(f"{base_url}/api/admin/appointments", headers=patient_headers)
        assert r.status_code == 403

    def test_admin_appointments_ok(self, base_url, admin_headers):
        r = requests.get(f"{base_url}/api/admin/appointments", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_stats_forbidden_for_patient(self, base_url, patient_headers):
        r = requests.get(f"{base_url}/api/admin/stats", headers=patient_headers)
        assert r.status_code == 403

    def test_admin_stats_ok(self, base_url, admin_headers):
        r = requests.get(f"{base_url}/api/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        for k in ["total_appointments", "today_appointments", "pending", "confirmed", "patients"]:
            assert k in r.json()

    def test_admin_update_status(self, api, base_url, admin_headers, patient_headers, db):
        svc = api.get(f"{base_url}/api/services").json()[0]["id"]
        den = api.get(f"{base_url}/api/dentists").json()[0]["id"]
        future_date = (datetime.utcnow() + timedelta(days=35)).strftime("%Y-%m-%d")
        # cleanup any prior test appt for this slot
        db.appointments.delete_many({"date": future_date, "time": "15:30", "dentist_id": den})
        c = requests.post(f"{base_url}/api/appointments", headers=patient_headers,
                          json={"service_id": svc, "dentist_id": den,
                                "date": future_date, "time": "15:30"})
        assert c.status_code == 200
        appt_id = c.json()["id"]

        r = requests.put(f"{base_url}/api/admin/appointments/{appt_id}",
                         headers=admin_headers, json={"status": "confirmed"})
        assert r.status_code == 200
        assert r.json()["status"] == "confirmed"

        # invalid status -> 400
        bad = requests.put(f"{base_url}/api/admin/appointments/{appt_id}",
                           headers=admin_headers, json={"status": "nonsense"})
        assert bad.status_code == 400

        # not found -> 404
        nf = requests.put(f"{base_url}/api/admin/appointments/does-not-exist",
                          headers=admin_headers, json={"status": "confirmed"})
        assert nf.status_code == 404

    def test_admin_can_cancel_any(self, api, base_url, admin_headers, patient_headers):
        svc = api.get(f"{base_url}/api/services").json()[0]["id"]
        den = api.get(f"{base_url}/api/dentists").json()[0]["id"]
        future_date = (datetime.utcnow() + timedelta(days=28)).strftime("%Y-%m-%d")
        c = requests.post(f"{base_url}/api/appointments", headers=patient_headers,
                          json={"service_id": svc, "dentist_id": den,
                                "date": future_date, "time": "16:30"})
        appt_id = c.json()["id"]
        r = requests.delete(f"{base_url}/api/appointments/{appt_id}", headers=admin_headers)
        assert r.status_code == 200


# ----- Role assignment logic (verified via DB seed since OAuth is mocked) -----
class TestRoleAssignment:
    def test_admin_email_gets_admin_role(self, base_url, admin_headers):
        r = requests.get(f"{base_url}/api/auth/me", headers=admin_headers)
        assert r.json()["role"] == "admin"
        assert r.json()["email"] == "admin@drjocelio.com.br"

    def test_non_admin_email_gets_patient_role(self, base_url, patient_headers):
        r = requests.get(f"{base_url}/api/auth/me", headers=patient_headers)
        assert r.json()["role"] == "patient"
