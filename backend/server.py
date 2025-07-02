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

class PaymentCreate(BaseModel):
    member_id: str
    amount: float
    payment_type: str  # "Mitgliedsbeitrag", "Zusatzgebühr", "Strafe"
    description: str
    due_date: datetime
    
class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    member_id: str
    amount: float
    payment_type: str
    description: str
    due_date: datetime
    paid_date: Optional[datetime] = None
    status: str = "Ausstehend"  # Ausstehend, Bezahlt, Überfällig
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PaymentUpdate(BaseModel):
    status: Optional[str] = None
    paid_date: Optional[datetime] = None
    amount: Optional[float] = None
    description: Optional[str] = None

class InvoiceCreate(BaseModel):
    member_id: str
    payment_ids: List[str]
    invoice_number: Optional[str] = None

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

# Payment Management Routes
@api_router.post("/admin/payments", response_model=Payment)
async def create_payment(payment_data: PaymentCreate, admin: dict = Depends(get_current_admin)):
    # Verify member belongs to this tenant
    member = await db.members.find_one({
        "id": payment_data.member_id,
        "tenant_id": admin["tenant_id"]
    })
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    
    payment_dict = payment_data.dict()
    payment_dict["tenant_id"] = admin["tenant_id"]
    
    # Set status based on due date
    if payment_data.due_date < datetime.utcnow():
        payment_dict["status"] = "Überfällig"
    
    payment_obj = Payment(**payment_dict)
    await db.payments.insert_one(payment_obj.dict())
    return payment_obj

@api_router.get("/admin/payments", response_model=List[Payment])
async def get_payments(admin: dict = Depends(get_current_admin)):
    payments = await db.payments.find({"tenant_id": admin["tenant_id"]}).to_list(1000)
    return [Payment(**payment) for payment in payments]

@api_router.get("/admin/payments/member/{member_id}", response_model=List[Payment])
async def get_member_payments(member_id: str, admin: dict = Depends(get_current_admin)):
    # Verify member belongs to this tenant
    member = await db.members.find_one({
        "id": member_id,
        "tenant_id": admin["tenant_id"]
    })
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    
    payments = await db.payments.find({
        "tenant_id": admin["tenant_id"],
        "member_id": member_id
    }).to_list(1000)
    return [Payment(**payment) for payment in payments]

@api_router.put("/admin/payments/{payment_id}", response_model=Payment)
async def update_payment(payment_id: str, payment_update: PaymentUpdate, admin: dict = Depends(get_current_admin)):
    payment = await db.payments.find_one({
        "id": payment_id,
        "tenant_id": admin["tenant_id"]
    })
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    
    update_data = {k: v for k, v in payment_update.dict().items() if v is not None}
    
    # If marking as paid, set paid_date
    if update_data.get("status") == "Bezahlt" and not update_data.get("paid_date"):
        update_data["paid_date"] = datetime.utcnow()
    
    if update_data:
        await db.payments.update_one(
            {"id": payment_id, "tenant_id": admin["tenant_id"]},
            {"$set": update_data}
        )
        
        updated_payment = await db.payments.find_one({
            "id": payment_id,
            "tenant_id": admin["tenant_id"]
        })
        return Payment(**updated_payment)
    
    return Payment(**payment)

@api_router.delete("/admin/payments/{payment_id}")
async def delete_payment(payment_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.payments.delete_one({
        "id": payment_id,
        "tenant_id": admin["tenant_id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    return {"message": "Zahlung erfolgreich gelöscht"}

# Invoice Generation
def generate_german_invoice_pdf(verein_info, member_info, payments, invoice_number):
    """Generate a German invoice PDF"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, 
                           topMargin=2*cm, bottomMargin=2*cm)
    
    story = []
    styles = getSampleStyleSheet()
    
    # Header
    header_style = styles['Heading1']
    header_style.alignment = 0  # Left align
    story.append(Paragraph(f"<b>{verein_info['name']}</b>", header_style))
    story.append(Spacer(1, 12))
    
    # Invoice info
    invoice_style = styles['Heading2']
    story.append(Paragraph(f"<b>Rechnung Nr.: {invoice_number}</b>", invoice_style))
    story.append(Paragraph(f"<b>Datum: {datetime.now().strftime('%d.%m.%Y')}</b>", styles['Normal']))
    story.append(Spacer(1, 24))
    
    # Member info
    story.append(Paragraph("<b>Rechnungsempfänger:</b>", styles['Heading3']))
    story.append(Paragraph(f"{member_info['name']}", styles['Normal']))
    story.append(Paragraph(f"{member_info['email']}", styles['Normal']))
    if member_info.get('address'):
        story.append(Paragraph(f"{member_info['address']}", styles['Normal']))
    story.append(Paragraph(f"Mitgliedsnummer: {member_info['membership_number']}", styles['Normal']))
    story.append(Spacer(1, 24))
    
    # Payment table
    story.append(Paragraph("<b>Rechnungsposten:</b>", styles['Heading3']))
    story.append(Spacer(1, 12))
    
    # Table data
    table_data = [
        ['Beschreibung', 'Art', 'Fälligkeitsdatum', 'Betrag (€)']
    ]
    
    total_amount = 0
    for payment in payments:
        table_data.append([
            payment['description'],
            payment['payment_type'],
            payment['due_date'].strftime('%d.%m.%Y'),
            f"{payment['amount']:.2f}"
        ])
        total_amount += payment['amount']
    
    # Add total row
    table_data.append(['', '', 'Gesamtbetrag:', f"{total_amount:.2f}"])
    
    # Create table
    table = Table(table_data, colWidths=[6*cm, 3*cm, 3*cm, 2*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -2), colors.beige),
        ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(table)
    story.append(Spacer(1, 24))
    
    # Payment instructions
    story.append(Paragraph("<b>Zahlungshinweise:</b>", styles['Heading3']))
    story.append(Paragraph("Bitte überweisen Sie den Betrag bis zum angegebenen Fälligkeitsdatum.", styles['Normal']))
    story.append(Paragraph("Bei Fragen zur Rechnung wenden Sie sich bitte an die Vereinsleitung.", styles['Normal']))
    story.append(Spacer(1, 12))
    
    # Footer
    story.append(Paragraph(f"Mit freundlichen Grüßen<br/>{verein_info['name']}", styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer

@api_router.post("/admin/invoices/generate")
async def generate_invoice(invoice_data: InvoiceCreate, admin: dict = Depends(get_current_admin)):
    # Get member info
    member = await db.members.find_one({
        "id": invoice_data.member_id,
        "tenant_id": admin["tenant_id"]
    })
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    
    # Get payments
    payments = []
    for payment_id in invoice_data.payment_ids:
        payment = await db.payments.find_one({
            "id": payment_id,
            "tenant_id": admin["tenant_id"],
            "member_id": invoice_data.member_id
        })
        if payment:
            payments.append(payment)
    
    if not payments:
        raise HTTPException(status_code=404, detail="Keine gültigen Zahlungen gefunden")
    
    # Get Verein info
    verein = await db.vereine.find_one({"id": admin["tenant_id"]})
    if not verein:
        raise HTTPException(status_code=404, detail="Verein nicht gefunden")
    
    # Generate invoice number if not provided
    invoice_number = invoice_data.invoice_number
    if not invoice_number:
        timestamp = int(datetime.now().timestamp())
        invoice_number = f"RE-{verein['subdomain']}-{timestamp}"
    
    # Generate PDF
    pdf_buffer = generate_german_invoice_pdf(verein, member, payments, invoice_number)
    
    # Return PDF as response
    return StreamingResponse(
        BytesIO(pdf_buffer.read()),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Rechnung_{invoice_number}.pdf"}
    )

# Financial Reports
@api_router.get("/admin/reports/financial")
async def get_financial_report(admin: dict = Depends(get_current_admin)):
    # Get all payments for this tenant
    payments = await db.payments.find({"tenant_id": admin["tenant_id"]}).to_list(1000)
    
    total_outstanding = 0
    total_paid = 0
    total_overdue = 0
    
    payments_by_type = {}
    
    for payment in payments:
        amount = payment['amount']
        status = payment['status']
        payment_type = payment['payment_type']
        
        if status == "Bezahlt":
            total_paid += amount
        elif status == "Überfällig":
            total_overdue += amount
        else:
            total_outstanding += amount
        
        if payment_type not in payments_by_type:
            payments_by_type[payment_type] = {
                "total": 0,
                "paid": 0,
                "outstanding": 0,
                "overdue": 0
            }
        
        payments_by_type[payment_type]["total"] += amount
        if status == "Bezahlt":
            payments_by_type[payment_type]["paid"] += amount
        elif status == "Überfällig":
            payments_by_type[payment_type]["overdue"] += amount
        else:
            payments_by_type[payment_type]["outstanding"] += amount
    
    return {
        "summary": {
            "total_outstanding": total_outstanding,
            "total_paid": total_paid,
            "total_overdue": total_overdue,
            "total_revenue": total_paid
        },
        "by_payment_type": payments_by_type,
        "total_payments": len(payments)
    }
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