from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, ResetPasswordRequest
from app.schemas.token import Token
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/signup", response_model=UserResponse)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.
    """
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    
    if len(user_in.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    hashed_password = get_password_hash(user_in.password)
    # Default role for all new signups is "user"
    role = "user"
    
    db_user = User(
        email=user_in.email,
        hashed_password=hashed_password,
        role=role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current user profile based on Bearer token.
    """
    return current_user


@router.post("/logout")
def logout():
    """
    Stateless JWT logout.
    The client should delete its stored token immediately.
    """
    return {"status": "success", "message": "Token invalidated client-side. Please clear local session."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Reset a user's password using a master reset secret code.
    """
    if req.reset_code != settings.RESET_SECRET_KEY:
        raise HTTPException(status_code=400, detail="Invalid reset code.")
        
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
        
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User with this email not found.")
        
    user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"status": "success", "message": "Password updated successfully."}

