from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import httpx
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}

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


class SessionRequest(BaseModel):
    session_id: str


class SessionResponse(BaseModel):
    session_token: str
    user: User


class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    duration_min: int
    price: float
    icon: str  # ionicon name


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
async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ============================================================
# Auth endpoints
# ============================================================
@api_router.post("/auth/session", response_model=SessionResponse)
async def auth_session(payload: SessionRequest):
    async with httpx.AsyncClient(timeout=15.0) as http:
        try:
            resp = await http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": payload.session_id},
            )
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Auth upstream error: {e}")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session id")

    data = resp.json()
    email = data.get("email")
    name = data.get("name") or email
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Invalid session data")

    email_lower = email.lower()
    role = "admin" if email_lower in ADMIN_EMAILS else "patient"

    existing = await db.users.find_one({"email": email_lower}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        # Keep role fresh if admin env changed
        new_role = role if role == "admin" else existing.get("role", "patient")
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "role": new_role}},
        )
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = User(
            user_id=user_id, email=email_lower, name=name, picture=picture, role=role
        ).model_dump()
        await db.users.insert_one(user_doc)
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})

    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        }
    )

    return SessionResponse(session_token=session_token, user=User(**user_doc))


@api_router.get("/auth/me", response_model=User)
async def auth_me(user: User = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
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
    items = await db.services.find({}, {"_id": 0}).to_list(100)
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
@api_router.get("/appointments/available-slots")
async def available_slots(date: str, dentist_id: str, user: User = Depends(get_current_user)):
    # Generate hourly slots 09:00-18:00, exclude any booked by this dentist on that date
    all_slots = [f"{h:02d}:00" for h in range(9, 18)] + [f"{h:02d}:30" for h in range(9, 18)]
    all_slots.sort()
    booked = await db.appointments.find(
        {"dentist_id": dentist_id, "date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0, "time": 1},
    ).to_list(200)
    taken = {b["time"] for b in booked}
    return {"slots": [s for s in all_slots if s not in taken]}


@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(payload: AppointmentCreate, user: User = Depends(get_current_user)):
    service = await db.services.find_one({"id": payload.service_id}, {"_id": 0})
    dentist = await db.dentists.find_one({"id": payload.dentist_id}, {"_id": 0})
    if not service or not dentist:
        raise HTTPException(status_code=400, detail="Invalid service or dentist")

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
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)

    # seed services
    if await db.services.count_documents({}) == 0:
        for s in SERVICES_SEED:
            await db.services.insert_one(Service(**s).model_dump())

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
