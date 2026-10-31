"""Safe staff-facing customer directory schemas."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: str
    is_active: bool
    created_at: datetime

class CustomerPage(BaseModel):
    items: list[CustomerResponse]
    offset: int
    limit: int
