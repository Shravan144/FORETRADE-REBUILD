from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)
    full_name: str | None = Field(default=None, max_length=200)
    company_name: str | None = Field(default=None, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    job_title: str | None = Field(default=None, max_length=150)


class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    job_title: str | None = None
