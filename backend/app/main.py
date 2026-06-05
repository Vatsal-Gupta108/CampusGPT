from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.api import api_router
from app.db.database import engine, Base, SessionLocal
from app import models
from app.models.user import User
from app.core.security import get_password_hash

# Create all tables in the database
Base.metadata.create_all(bind=engine)

# Seed admin user if it doesn't exist
db = SessionLocal()
try:
    admin_user = db.query(User).filter(User.email == "admin@gmail.com").first()
    if not admin_user:
        hashed_password = get_password_hash("admin iitm")
        admin_user = User(
            email="admin@gmail.com",
            hashed_password=hashed_password,
            role="admin"
        )
        db.add(admin_user)
        db.commit()
finally:
    db.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS
# In production, this uses the FRONTEND_URL environment variable
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://[::1]:3000",
        "https://campus-gpt-theta.vercel.app"
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API. Go to /docs for Swagger UI."}
