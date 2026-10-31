"""Read-only customer directory for subscription managers."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models import User, UserRole
from app.schemas.customers import CustomerPage

router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("", response_model=CustomerPage)
def list_customers(
    offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db), _manager: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
) -> CustomerPage:
    items = db.scalars(select(User).where(User.role == UserRole.CUSTOMER).order_by(User.email).offset(offset).limit(limit)).all()
    return CustomerPage(items=items, offset=offset, limit=limit)
