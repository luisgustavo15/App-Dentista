from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import time
import secrets
import jwt
import bcrypt
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_ACCESS_PASSWORD = os.environ["ADMIN_ACCESS_PASSWORD"]
JWT_ALG = "HS256"
TOKEN_DAYS = 7
ADMIN_USER_ID = "admin"

# Per-process brute force limiter: max 5 failures per key in 15 minutes
_failures: dict = {}

app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api_router = APIRouter(prefix="/api")


# ============================================================
# Models
# ============================================================
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "patient"  # patient | admin
    phone: Optional[str] = None
    birth_date: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    phone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class AdminLoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class AuthResponse(BaseModel):
    access_token: str
    user: User


class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    duration_min: int
    price: float
    icon: str  # ionicon name
    active: bool = True


class ServiceIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=400)
    duration_min: int = Field(ge=5, le=480)
    price: float = Field(ge=0, le=1_000_000)
    icon: str = Field(default="medkit-outline", max_length=60)


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=400)
    duration_min: Optional[int] = Field(default=None, ge=5, le=480)
    price: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    icon: Optional[str] = Field(default=None, max_length=60)
    active: Optional[bool] = None


class Dentist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    specialty: str
    bio: str
    photo: str
    cro: str  # dentist license number


class GalleryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    before_image: str
    after_image: str
    service_name: str


class AppointmentCreate(BaseModel):
    service_id: str
    dentist_id: str
    date: str  # YYYY-MM-DD
    time: str  # HH:mm
    notes: Optional[str] = ""


class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    patient_name: str
    patient_email: str
    service_id: str
    service_name: str
    dentist_id: str
    dentist_name: str
    date: str
    time: str
    notes: str = ""
    price: float = 0.0  # service price frozen at booking time
    status: str = "pending"  # pending | confirmed | cancelled | completed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AppointmentStatusUpdate(BaseModel):
    status: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[str] = None


# ============================================================
# Auth helpers
# ============================================================
def _hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def _check_pw(pw: str, stored: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), stored.encode())
    except (ValueError, TypeError):
        return False


def _make_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    claims = {"sub": user_id, "role": role, "iat": now, "exp": now + timedelta(days=TOKEN_DAYS),
              "jti": secrets.token_urlsafe(12)}
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALG)


def _rate_key(request: Request, ident: str) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")
    return f"{ip}:{ident.lower()}"


def _allowed(key: str) -> bool:
    now = time.time()
    _failures[key] = [t for t in _failures.get(key, []) if now - t < 900]
    return len(_failures[key]) < 5


def _fail(key: str):
    _failures.setdefault(key, []).append(time.time())


async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_doc = await db.users.find_one({"user_id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user_doc or user_doc.get("role") != payload.get("role"):
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ============================================================
# Auth endpoints
# ============================================================
@api_router.post("/auth/register", response_model=AuthResponse, status_code=201)
async def auth_register(payload: RegisterIn):
    email = str(payload.email).lower()
    if await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1}):
        raise HTTPException(status_code=409, detail="Este e-mail já está cadastrado")
    user = User(user_id=f"user_{uuid.uuid4().hex[:12]}", email=email, name=payload.name.strip(),
                phone=payload.phone, role="patient")
    doc = user.model_dump()
    doc["password_hash"] = _hash_pw(payload.password)
    await db.users.insert_one(doc)
    return AuthResponse(access_token=_make_token(user.user_id, "patient"), user=user)


@api_router.post("/auth/login", response_model=AuthResponse)
async def auth_login(payload: LoginIn, request: Request):
    email = str(payload.email).lower()
    key = _rate_key(request, email)
    if not _allowed(key):
        raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente em 15 minutos.")
    doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not doc or doc.get("role") != "patient" or not _check_pw(payload.password, doc.get("password_hash", "")):
        _fail(key)
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    doc.pop("password_hash", None)
    return AuthResponse(access_token=_make_token(doc["user_id"], "patient"), user=User(**doc))


@api_router.post("/auth/admin-login", response_model=AuthResponse)
async def auth_admin_login(payload: AdminLoginIn, request: Request):
    key = _rate_key(request, "admin")
    if not _allowed(key):
        raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente em 15 minutos.")
    if not secrets.compare_digest(payload.password.encode(), ADMIN_ACCESS_PASSWORD.encode()):
        _fail(key)
        raise HTTPException(status_code=401, detail="Senha de acesso incorreta")
    doc = await db.users.find_one({"user_id": ADMIN_USER_ID}, {"_id": 0, "password_hash": 0})
    return AuthResponse(access_token=_make_token(ADMIN_USER_ID, "admin"), user=User(**doc))


@api_router.get("/auth/me", response_model=User)
async def auth_me(user: User = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def auth_logout():
    # Stateless JWT: the client deletes its token.
    return {"ok": True}


@api_router.put("/auth/profile", response_model=User)
async def update_profile(payload: ProfileUpdate, user: User = Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"user_id": user.user_id}, {"$set": update})
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**doc)


# ============================================================
# Services
# ============================================================
@api_router.get("/services", response_model=List[Service])
async def list_services():
    items = await db.services.find({"active": {"$ne": False}}, {"_id": 0}).to_list(200)
    return [Service(**s) for s in items]


# ============================================================
# Dentists / Team
# ============================================================
@api_router.get("/dentists", response_model=List[Dentist])
async def list_dentists():
    items = await db.dentists.find({}, {"_id": 0}).to_list(100)
    return [Dentist(**s) for s in items]


# ============================================================
# Gallery
# ============================================================
@api_router.get("/gallery", response_model=List[GalleryItem])
async def list_gallery():
    items = await db.gallery.find({}, {"_id": 0}).to_list(100)
    return [GalleryItem(**s) for s in items]


# ============================================================
# Appointments
# ============================================================
CLINIC_TZ = ZoneInfo("America/Sao_Paulo")


def _day_slots(date_str: str) -> List[str]:
    """Slots inside clinic hours (Mon-Fri 08:00-19:00, Sat 09:00-13:00), future only."""
    try:
        day = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida")
    wd = day.weekday()
    if wd == 6:
        return []
    start, end = (9, 13) if wd == 5 else (8, 19)
    now = datetime.now(CLINIC_TZ)
    slots = []
    for h in range(start, end):
        for m in (0, 30):
            slot_dt = datetime(day.year, day.month, day.day, h, m, tzinfo=CLINIC_TZ)
            if slot_dt > now:
                slots.append(f"{h:02d}:{m:02d}")
    return slots


@api_router.get("/appointments/available-slots")
async def available_slots(date: str, dentist_id: str, user: User = Depends(get_current_user)):
    all_slots = _day_slots(date)
    booked = await db.appointments.find(
        {"dentist_id": dentist_id, "date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0, "time": 1},
    ).to_list(200)
    taken = {b["time"] for b in booked}
    return {"slots": [s for s in all_slots if s not in taken]}


@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(payload: AppointmentCreate, user: User = Depends(get_current_user)):
    service = await db.services.find_one({"id": payload.service_id, "active": {"$ne": False}}, {"_id": 0})
    dentist = await db.dentists.find_one({"id": payload.dentist_id}, {"_id": 0})
    if not service or not dentist:
        raise HTTPException(status_code=400, detail="Invalid service or dentist")
    if payload.time not in _day_slots(payload.date):
        raise HTTPException(status_code=400, detail="Horário fora do expediente ou já passou")

    # Block double-booking
    clash = await db.appointments.find_one(
        {
            "dentist_id": payload.dentist_id,
            "date": payload.date,
            "time": payload.time,
            "status": {"$ne": "cancelled"},
        },
        {"_id": 0},
    )
    if clash:
        raise HTTPException(status_code=409, detail="Horário indisponível")

    appt = Appointment(
        user_id=user.user_id,
        patient_name=user.name,
        patient_email=user.email,
        service_id=service["id"],
        service_name=service["name"],
        dentist_id=dentist["id"],
        dentist_name=dentist["name"],
        date=payload.date,
        time=payload.time,
        notes=payload.notes or "",
        price=float(service["price"]),
    )
    await db.appointments.insert_one(appt.model_dump())
    return appt


@api_router.get("/appointments/mine", response_model=List[Appointment])
async def my_appointments(user: User = Depends(get_current_user)):
    items = await db.appointments.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    items.sort(key=lambda a: (a["date"], a["time"]), reverse=True)
    return [Appointment(**a) for a in items]


@api_router.delete("/appointments/{appt_id}")
async def cancel_my_appointment(appt_id: str, user: User = Depends(get_current_user)):
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    if appt["user_id"] != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão")
    await db.appointments.update_one({"id": appt_id}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


# ---------- Admin ----------
@api_router.get("/admin/appointments", response_model=List[Appointment])
async def admin_list_appointments(user: User = Depends(require_admin)):
    items = await db.appointments.find({}, {"_id": 0}).to_list(1000)
    items.sort(key=lambda a: (a["date"], a["time"]))
    return [Appointment(**a) for a in items]


@api_router.put("/admin/appointments/{appt_id}", response_model=Appointment)
async def admin_update_status(
    appt_id: str, payload: AppointmentStatusUpdate, user: User = Depends(require_admin)
):
    if payload.status not in {"pending", "confirmed", "cancelled", "completed"}:
        raise HTTPException(status_code=400, detail="Status inválido")
    res = await db.appointments.update_one({"id": appt_id}, {"$set": {"status": payload.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    doc = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    return Appointment(**doc)


@api_router.get("/admin/stats")
async def admin_stats(user: User = Depends(require_admin)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total = await db.appointments.count_documents({})
    today_count = await db.appointments.count_documents({"date": today})
    pending = await db.appointments.count_documents({"status": "pending"})
    confirmed = await db.appointments.count_documents({"status": "confirmed"})
    patients = await db.users.count_documents({"role": "patient"})
    return {
        "total_appointments": total,
        "today_appointments": today_count,
        "pending": pending,
        "confirmed": confirmed,
        "patients": patients,
    }


# ---------- Admin: procedures ----------
@api_router.get("/admin/services", response_model=List[Service])
async def admin_list_services(user: User = Depends(require_admin)):
    items = await db.services.find({}, {"_id": 0}).to_list(500)
    items.sort(key=lambda s: s["name"].lower())
    return [Service(**s) for s in items]


@api_router.post("/admin/services", response_model=Service, status_code=201)
async def admin_create_service(payload: ServiceIn, user: User = Depends(require_admin)):
    svc = Service(**payload.model_dump())
    await db.services.insert_one(svc.model_dump())
    return svc


@api_router.put("/admin/services/{service_id}", response_model=Service)
async def admin_update_service(service_id: str, payload: ServiceUpdate, user: User = Depends(require_admin)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    res = await db.services.update_one({"id": service_id}, {"$set": update}) if update else None
    doc = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not doc or (res is not None and res.matched_count == 0):
        raise HTTPException(status_code=404, detail="Procedimento não encontrado")
    if "name" in update:
        await db.appointments.update_many(
            {"service_id": service_id, "status": {"$in": ["pending", "confirmed"]}},
            {"$set": {"service_name": update["name"]}},
        )
    return Service(**doc)


@api_router.delete("/admin/services/{service_id}")
async def admin_remove_service(service_id: str, user: User = Depends(require_admin)):
    # Soft delete: keeps history/finance intact and allows restoring later.
    res = await db.services.update_one({"id": service_id}, {"$set": {"active": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Procedimento não encontrado")
    return {"ok": True}


# ---------- Admin: finance ----------
def _period_range(period: str):
    today = datetime.now(CLINIC_TZ).date()
    if period == "month":
        start = today.replace(day=1)
        return str(start), str(today)
    if period == "last_month":
        end = today.replace(day=1) - timedelta(days=1)
        return str(end.replace(day=1)), str(end)
    if period == "year":
        return str(today.replace(month=1, day=1)), str(today)
    if period == "all":
        return None, None
    raise HTTPException(status_code=400, detail="Período inválido")


@api_router.get("/admin/finance")
async def admin_finance(period: str = "month", user: User = Depends(require_admin)):
    start, end = _period_range(period)
    query: dict = {"status": "completed"}
    if start:
        query["date"] = {"$gte": start, "$lte": end}
    done = await db.appointments.find(query, {"_id": 0}).to_list(10000)

    by_service: dict = {}
    for a in done:
        row = by_service.setdefault(a["service_name"], {"service_name": a["service_name"], "count": 0, "revenue": 0.0})
        row["count"] += 1
        row["revenue"] += float(a.get("price", 0))
    total = sum(r["revenue"] for r in by_service.values())
    count = len(done)

    upcoming = await db.appointments.find(
        {"status": {"$in": ["pending", "confirmed"]}}, {"_id": 0, "price": 1}
    ).to_list(10000)
    return {
        "period": period,
        "start": start,
        "end": end,
        "total_revenue": round(total, 2),
        "completed_count": count,
        "average_ticket": round(total / count, 2) if count else 0.0,
        "expected_revenue": round(sum(float(u.get("price", 0)) for u in upcoming), 2),
        "by_service": sorted(by_service.values(), key=lambda r: r["revenue"], reverse=True),
    }


# ============================================================
# Contact (static clinic info)
# ============================================================
@api_router.get("/clinic")
async def clinic_info():
    return {
        "name": "Clínica Odontológica Dr. Jocélio",
        "address": "Av. Paulista, 1500 - Bela Vista, São Paulo - SP",
        "phone": "+55 11 99999-0000",
        "whatsapp": "+55 11 99999-0000",
        "email": "contato@drjocelio.com.br",
        "hours": "Seg a Sex: 08:00 - 19:00 | Sáb: 09:00 - 13:00",
        "lat": -23.5614,
        "lng": -46.6558,
    }


# ============================================================
# Seed
# ============================================================
SERVICES_SEED = [
    {"name": "Limpeza e Profilaxia", "description": "Limpeza profissional, remoção de tártaro e polimento dental.", "duration_min": 45, "price": 180.0, "icon": "sparkles-outline"},
    {"name": "Clareamento Dental", "description": "Clareamento com laser para um sorriso mais branco e brilhante.", "duration_min": 60, "price": 850.0, "icon": "sunny-outline"},
    {"name": "Ortodontia", "description": "Aparelhos fixos, invisíveis (Invisalign) e manutenção ortodôntica.", "duration_min": 60, "price": 450.0, "icon": "git-branch-outline"},
    {"name": "Implante Dentário", "description": "Reposição de dentes perdidos com implantes de titânio.", "duration_min": 90, "price": 3200.0, "icon": "medkit-outline"},
    {"name": "Canal (Endodontia)", "description": "Tratamento de canal com tecnologia moderna e indolor.", "duration_min": 75, "price": 950.0, "icon": "pulse-outline"},
    {"name": "Restauração Estética", "description": "Restaurações em resina ou porcelana com acabamento natural.", "duration_min": 50, "price": 320.0, "icon": "color-wand-outline"},
    {"name": "Prótese Dentária", "description": "Próteses fixas, removíveis e sobre implantes.", "duration_min": 60, "price": 1800.0, "icon": "construct-outline"},
    {"name": "Odontopediatria", "description": "Atendimento odontológico infantil especializado.", "duration_min": 40, "price": 220.0, "icon": "happy-outline"},
]

DENTISTS_SEED = [
    {
        "name": "Dr. Jocélio Souza",
        "specialty": "Implantodontia e Estética",
        "bio": "Mais de 20 anos de experiência, especialista em implantes e harmonização do sorriso. Formado pela USP com pós-graduação em Implantodontia.",
        "photo": "https://images.unsplash.com/photo-1667133295308-9ef24f71952e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYWxlJTIwZGVudGlzdCUyMHNtaWxpbmd8ZW58MHx8fHwxNzkzNTQyMDk0fDA&ixlib=rb-4.1.0&q=85",
        "cro": "CRO-SP 54321",
    },
    {
        "name": "Dra. Ana Beatriz Lima",
        "specialty": "Ortodontia e Odontopediatria",
        "bio": "Especialista em ortodontia invisível e tratamento infantil, com formação em alinhadores Invisalign.",
        "photo": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80",
        "cro": "CRO-SP 65432",
    },
    {
        "name": "Dr. Rafael Mendes",
        "specialty": "Endodontia",
        "bio": "Especialista em tratamentos de canal com microscópio e técnicas minimamente invasivas.",
        "photo": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&q=80",
        "cro": "CRO-SP 76543",
    },
]

GALLERY_SEED = [
    {
        "title": "Clareamento Transformador",
        "description": "Resultado após 3 sessões de clareamento a laser.",
        "before_image": "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&q=80",
        "after_image": "https://images.unsplash.com/photo-1588776813677-77aaf5595b83?w=600&q=80",
        "service_name": "Clareamento Dental",
    },
    {
        "title": "Alinhamento Ortodôntico",
        "description": "Correção com Invisalign em 14 meses.",
        "before_image": "https://images.unsplash.com/photo-1559591935-c6c92c6f31ff?w=600&q=80",
        "after_image": "https://images.unsplash.com/photo-1581585099522-f6ac2efe5b5d?w=600&q=80",
        "service_name": "Ortodontia",
    },
    {
        "title": "Implante Unitário",
        "description": "Reposição do dente anterior com implante e coroa de porcelana.",
        "before_image": "https://images.unsplash.com/photo-1588776814546-ec7a74d4b6a1?w=600&q=80",
        "after_image": "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=600&q=80",
        "service_name": "Implante Dentário",
    },
]


@app.on_event("startup")
async def startup_seed():
    # indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)

    # Admin account (accessed only via ADMIN_ACCESS_PASSWORD)
    if not await db.users.find_one({"user_id": ADMIN_USER_ID}, {"_id": 0, "user_id": 1}):
        await db.users.insert_one(User(user_id=ADMIN_USER_ID, email="admin@drjocelio.local",
                                       name="Dr. Jocélio", role="admin").model_dump())

    # seed services
    if await db.services.count_documents({}) == 0:
        for s in SERVICES_SEED:
            await db.services.insert_one(Service(**s).model_dump())

    # Backfill frozen price for appointments created before prices were stored
    async for a in db.appointments.find({"price": {"$exists": False}}, {"_id": 0, "id": 1, "service_id": 1}):
        svc = await db.services.find_one({"id": a["service_id"]}, {"_id": 0, "price": 1})
        await db.appointments.update_one({"id": a["id"]}, {"$set": {"price": float(svc["price"]) if svc else 0.0}})

    if await db.dentists.count_documents({}) == 0:
        for d in DENTISTS_SEED:
            await db.dentists.insert_one(Dentist(**d).model_dump())

    if await db.gallery.count_documents({}) == 0:
        for g in GALLERY_SEED:
            await db.gallery.insert_one(GalleryItem(**g).model_dump())


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
