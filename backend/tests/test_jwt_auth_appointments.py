"""JWT auth (patient email/password + admin access password) and appointments regression tests."""
import random
from datetime import date, timedelta
import jwt as pyjwt
import pytest

from conftest import BASE_URL


# ---------- Public catalog ----------
class TestPublic:
    def test_services(self, api):
        r = api.get(f"{BASE_URL}/api/services")
        assert r.status_code == 200 and len(r.json()) >= 8 and "_id" not in r.json()[0]

    def test_dentists(self, api):
        r = api.get(f"{BASE_URL}/api/dentists")
        assert r.status_code == 200 and len(r.json()) == 3


# ---------- Register ----------
class TestRegister:
    def test_register_ok_and_me(self, api, uniq):
        email = f"TEST_{uniq}@example.com"
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"name": "TEST User", "email": email, "password": "abc123", "phone": "11999"})
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["access_token"] and d["user"]["role"] == "patient"
        assert d["user"]["email"] == email.lower()
        assert "password_hash" not in d["user"]
        me = api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {d['access_token']}"})
        assert me.status_code == 200 and me.json()["email"] == email.lower()
        # duplicate (case-insensitive)
        r2 = api.post(f"{BASE_URL}/api/auth/register",
                      json={"name": "TEST User", "email": email.upper(), "password": "abc123"})
        assert r2.status_code == 409
        # login with new account
        r3 = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "abc123"})
        assert r3.status_code == 200 and r3.json()["user"]["role"] == "patient"

    def test_register_short_password_422(self, api, uniq):
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"name": "TEST", "email": f"TEST_{uniq}@example.com", "password": "123"})
        assert r.status_code == 422

    def test_register_invalid_email_422(self, api):
        r = api.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST", "email": "bad", "password": "abcdef"})
        assert r.status_code == 422


# ---------- Login ----------
class TestLogin:
    def test_patient_login_ok(self, patient_auth):
        _, user = patient_auth
        assert user["role"] == "patient" and user["email"] == "maria@test.com"

    def test_wrong_password_401_then_429(self, api, uniq):
        email = f"TEST_rl_{uniq}@example.com"
        api.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST", "email": email, "password": "abc123"})
        codes = [api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "wrong!"}).status_code
                 for _ in range(6)]
        assert codes[0] == 401
        assert codes[5] == 429, codes

    def test_admin_email_rejected_on_patient_login(self, api):
        # .local TLD is rejected by EmailStr (422); either way admin can't log in via patient endpoint
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@drjocelio.local", "password": "x"})
        assert r.status_code in (401, 422)


# ---------- Admin login ----------
class TestAdminLogin:
    def test_admin_login_ok(self, admin_auth):
        _, user = admin_auth
        assert user["role"] == "admin" and user["user_id"] == "admin"

    def test_admin_login_wrong_401(self, api, admin_auth):
        r = api.post(f"{BASE_URL}/api/auth/admin-login", json={"password": "wrong"})
        assert r.status_code == 401


# ---------- Token validation ----------
class TestMe:
    def test_missing_token_401(self, api):
        assert api.get(f"{BASE_URL}/api/auth/me").status_code == 401

    def test_tampered_token_401(self, api, patient_auth):
        h, _ = patient_auth
        tok = h["Authorization"].split(" ")[1]
        bad = tok[:-3] + ("aaa" if tok[-3:] != "aaa" else "bbb")
        assert api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401

    def test_forged_role_token_401(self, api, patient_auth):
        h, user = patient_auth
        forged = pyjwt.encode({"sub": user["user_id"], "role": "admin"}, "wrongsecret", algorithm="HS256")
        assert api.get(f"{BASE_URL}/api/admin/stats", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


# ---------- Admin RBAC ----------
class TestAdminRBAC:
    def test_patient_forbidden(self, api, patient_auth):
        h, _ = patient_auth
        assert api.get(f"{BASE_URL}/api/admin/stats", headers=h).status_code == 403
        assert api.get(f"{BASE_URL}/api/admin/appointments", headers=h).status_code == 403
        assert api.put(f"{BASE_URL}/api/admin/appointments/x", json={"status": "confirmed"}, headers=h).status_code == 403

    def test_admin_ok(self, api, admin_auth):
        h, _ = admin_auth
        s = api.get(f"{BASE_URL}/api/admin/stats", headers=h)
        assert s.status_code == 200 and isinstance(s.json()["patients"], int)
        assert api.get(f"{BASE_URL}/api/admin/appointments", headers=h).status_code == 200


# ---------- Appointment flow ----------
class TestAppointments:
    def test_full_flow(self, api, patient_auth, admin_auth):
        ph, _ = patient_auth
        ah, _ = admin_auth
        svc = api.get(f"{BASE_URL}/api/services").json()[0]
        den = api.get(f"{BASE_URL}/api/dentists").json()[2]
        d = (date.today() + timedelta(days=random.randint(200, 900))).isoformat()
        sl = api.get(f"{BASE_URL}/api/appointments/available-slots", params={"date": d, "dentist_id": den["id"]}, headers=ph)
        assert sl.status_code == 200 and len(sl.json()["slots"]) in (0, 8, 22)
        t = sl.json()["slots"][0]
        c = api.post(f"{BASE_URL}/api/appointments", headers=ph,
                     json={"service_id": svc["id"], "dentist_id": den["id"], "date": d, "time": t, "notes": "TEST"})
        assert c.status_code == 200, c.text
        appt = c.json()
        assert appt["status"] == "pending"
        dup = api.post(f"{BASE_URL}/api/appointments", headers=ph,
                       json={"service_id": svc["id"], "dentist_id": den["id"], "date": d, "time": t})
        assert dup.status_code == 409
        mine = api.get(f"{BASE_URL}/api/appointments/mine", headers=ph).json()
        assert any(a["id"] == appt["id"] for a in mine)
        sl2 = api.get(f"{BASE_URL}/api/appointments/available-slots", params={"date": d, "dentist_id": den["id"]}, headers=ph)
        assert t not in sl2.json()["slots"]
        u = api.put(f"{BASE_URL}/api/admin/appointments/{appt['id']}", json={"status": "confirmed"}, headers=ah)
        assert u.status_code == 200 and u.json()["status"] == "confirmed"
        bad = api.put(f"{BASE_URL}/api/admin/appointments/{appt['id']}", json={"status": "zzz"}, headers=ah)
        assert bad.status_code == 400
        cx = api.delete(f"{BASE_URL}/api/appointments/{appt['id']}", headers=ph)
        assert cx.status_code == 200
        mine2 = api.get(f"{BASE_URL}/api/appointments/mine", headers=ph).json()
        assert [a for a in mine2 if a["id"] == appt["id"]][0]["status"] == "cancelled"

    def test_create_requires_auth(self, api):
        assert api.post(f"{BASE_URL}/api/appointments", json={}).status_code in (401, 422)
        assert api.get(f"{BASE_URL}/api/appointments/mine").status_code == 401
