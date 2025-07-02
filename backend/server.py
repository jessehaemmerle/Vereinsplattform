from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
import hashlib
from urllib.parse import urlparse
from io import BytesIO
import decimal
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import cm


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)
SECRET_KEY = "your-secret-key-change-in-production"

# Models
class VereinCreate(BaseModel):
    name: str
    subdomain: str
    description: Optional[str] = ""
    admin_email: str
    admin_password: str

class Verein(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    subdomain: str
    description: Optional[str] = ""
    admin_email: str
    admin_password: str  # This was missing!
    created_at: datetime = Field(default_factory=datetime.utcnow)
    active: bool = True

class AdminLogin(BaseModel):
    email: str
    password: str
    subdomain: str

class MemberCreate(BaseModel):
    name: str
    email: str
    membership_number: str
    membership_type: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    fees_status: str = "Offen"  # Offen, Bezahlt, Überfällig

class Member(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    name: str
    email: str
    membership_number: str
    membership_type: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    fees_status: str = "Offen"
    join_date: datetime = Field(default_factory=datetime.utcnow)
    active: bool = True

class MemberLogin(BaseModel):
    email: str
    membership_number: str
    subdomain: str

class MemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    membership_number: Optional[str] = None
    membership_type: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    fees_status: Optional[str] = None

# Utility functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_jwt_token(data: dict, expires_delta: timedelta = timedelta(hours=24)):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")

def verify_jwt_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        return None

async def get_current_tenant(request: Request):
    host = request.headers.get("host", "")
    # Extract subdomain from host
    if "." in host:
        subdomain = host.split(".")[0]
        verein = await db.vereine.find_one({"subdomain": subdomain})
        if verein:
            return verein["id"]
    return None

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Token erforderlich")
    
    payload = verify_jwt_token(credentials.credentials)
    if not payload or payload.get("type") != "admin":
        raise HTTPException(status_code=401, detail="Ungültiges Admin-Token")
    
    return payload

async def get_current_member(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Token erforderlich")
    
    payload = verify_jwt_token(credentials.credentials)
    if not payload or payload.get("type") != "member":
        raise HTTPException(status_code=401, detail="Ungültiges Mitglieder-Token")
    
    return payload

# Routes

@api_router.get("/")
async def root():
    return {"message": "Verein Management System API"}

# Verein Management Routes
@api_router.post("/vereine", response_model=dict)
async def create_verein(verein_data: VereinCreate):
    # Check if subdomain already exists
    existing = await db.vereine.find_one({"subdomain": verein_data.subdomain})
    if existing:
        raise HTTPException(status_code=400, detail="Subdomain bereits vergeben")
    
    # Check if admin email already exists
    existing_admin = await db.vereine.find_one({"admin_email": verein_data.admin_email})
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin E-Mail bereits vergeben")
    
    verein_dict = verein_data.dict()
    verein_dict["admin_password"] = hash_password(verein_data.admin_password)
    verein_obj = Verein(**verein_dict)
    
    await db.vereine.insert_one(verein_obj.dict())
    
    return {"message": "Verein erfolgreich erstellt", "subdomain": verein_data.subdomain}

@api_router.post("/admin/login")
async def admin_login(login_data: AdminLogin):
    verein = await db.vereine.find_one({
        "subdomain": login_data.subdomain,
        "admin_email": login_data.email,
        "admin_password": hash_password(login_data.password)
    })
    
    if not verein:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    token = create_jwt_token({
        "email": verein["admin_email"],
        "tenant_id": verein["id"],
        "type": "admin"
    })
    
    return {"token": token, "verein_name": verein["name"]}

@api_router.get("/admin/verein")
async def get_verein_info(admin: dict = Depends(get_current_admin)):
    verein = await db.vereine.find_one({"id": admin["tenant_id"]})
    if not verein:
        raise HTTPException(status_code=404, detail="Verein nicht gefunden")
    
    # Return Verein info without the password
    return {
        "id": verein["id"],
        "name": verein["name"],
        "subdomain": verein["subdomain"],
        "description": verein["description"],
        "created_at": verein["created_at"]
    }

# Member Management Routes
@api_router.post("/admin/members", response_model=Member)
async def create_member(member_data: MemberCreate, admin: dict = Depends(get_current_admin)):
    # Check if membership number already exists for this tenant
    existing = await db.members.find_one({
        "tenant_id": admin["tenant_id"],
        "membership_number": member_data.membership_number
    })
    if existing:
        raise HTTPException(status_code=400, detail="Mitgliedsnummer bereits vergeben")
    
    # Check if email already exists for this tenant
    existing_email = await db.members.find_one({
        "tenant_id": admin["tenant_id"],
        "email": member_data.email
    })
    if existing_email:
        raise HTTPException(status_code=400, detail="E-Mail bereits vergeben")
    
    member_dict = member_data.dict()
    member_dict["tenant_id"] = admin["tenant_id"]
    member_obj = Member(**member_dict)
    
    await db.members.insert_one(member_obj.dict())
    return member_obj

@api_router.get("/admin/members", response_model=List[Member])
async def get_members(admin: dict = Depends(get_current_admin)):
    members = await db.members.find({"tenant_id": admin["tenant_id"]}).to_list(1000)
    return [Member(**member) for member in members]

@api_router.get("/admin/members/{member_id}", response_model=Member)
async def get_member(member_id: str, admin: dict = Depends(get_current_admin)):
    member = await db.members.find_one({"id": member_id, "tenant_id": admin["tenant_id"]})
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    return Member(**member)

@api_router.put("/admin/members/{member_id}", response_model=Member)
async def update_member(member_id: str, member_update: MemberUpdate, admin: dict = Depends(get_current_admin)):
    member = await db.members.find_one({"id": member_id, "tenant_id": admin["tenant_id"]})
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    
    update_data = {k: v for k, v in member_update.dict().items() if v is not None}
    
    if update_data:
        await db.members.update_one(
            {"id": member_id, "tenant_id": admin["tenant_id"]},
            {"$set": update_data}
        )
        
        updated_member = await db.members.find_one({"id": member_id, "tenant_id": admin["tenant_id"]})
        return Member(**updated_member)
    
    return Member(**member)

@api_router.delete("/admin/members/{member_id}")
async def delete_member(member_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.members.delete_one({"id": member_id, "tenant_id": admin["tenant_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    return {"message": "Mitglied erfolgreich gelöscht"}

# Member Portal Routes
@api_router.post("/member/login")
async def member_login(login_data: MemberLogin):
    # Get tenant_id from subdomain
    verein = await db.vereine.find_one({"subdomain": login_data.subdomain})
    if not verein:
        raise HTTPException(status_code=404, detail="Verein nicht gefunden")
    
    member = await db.members.find_one({
        "tenant_id": verein["id"],
        "email": login_data.email,
        "membership_number": login_data.membership_number,
        "active": True
    })
    
    if not member:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    token = create_jwt_token({
        "email": member["email"],
        "member_id": member["id"],
        "tenant_id": verein["id"],
        "type": "member"
    })
    
    return {"token": token, "member_name": member["name"]}

@api_router.get("/member/profile", response_model=Member)
async def get_member_profile(member: dict = Depends(get_current_member)):
    member_data = await db.members.find_one({"id": member["member_id"]})
    if not member_data:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    return Member(**member_data)

@api_router.get("/member/verein")
async def get_member_verein_info(member: dict = Depends(get_current_member)):
    verein = await db.vereine.find_one({"id": member["tenant_id"]})
    if not verein:
        raise HTTPException(status_code=404, detail="Verein nicht gefunden")
    
    return {
        "name": verein["name"],
        "description": verein["description"]
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()