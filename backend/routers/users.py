from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from backend.database import get_db, serialize_doc

router = APIRouter(prefix="/api/users", tags=["users"])

class UserSyncRequest(BaseModel):
    uid: str
    email: str
    name: str
    role: Optional[str] = "user"
    companyName: Optional[str] = None

class UserProfileRequest(BaseModel):
    uid: str

class UserRoleRequest(BaseModel):
    uid: str
    role: Optional[str] = None
    companyName: Optional[str] = None

@router.post("/sync")
async def sync_user(req: UserSyncRequest):
    if not req.uid or not req.email or not req.name:
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Recruiter accounts must include a valid companyName
    if req.role == "recruiter":
        if not req.companyName or not req.companyName.strip():
            raise HTTPException(status_code=400, detail="Company name is required for recruiters")

    db = get_db()
    existing_user = await db.users.find_one({"firebaseUid": req.uid})

    clean_company = req.companyName.strip() if req.companyName else None

    if existing_user:
        update_fields = {}
        if clean_company and (req.role == "recruiter" or existing_user.get("role") == "recruiter"):
            update_fields["companyName"] = clean_company
        if req.role and req.role != existing_user.get("role"):
            update_fields["role"] = req.role
        if req.name and req.name != existing_user.get("name"):
            update_fields["name"] = req.name

        if update_fields:
            await db.users.update_one({"firebaseUid": req.uid}, {"$set": update_fields})
            existing_user.update(update_fields)

        return {
            "message": "User updated successfully" if update_fields else "User already exists",
            "user": serialize_doc(existing_user)
        }

    new_user = {
        "firebaseUid": req.uid,
        "email": req.email,
        "name": req.name,
        "role": req.role or "user",
        "companyName": clean_company if req.role == "recruiter" else None,
        "createdAt": datetime.utcnow()
    }
    result = await db.users.insert_one(new_user)
    new_user["_id"] = result.inserted_id

    return {
        "message": "User created successfully",
        "user": serialize_doc(new_user)
    }

@router.post("/profile")
async def get_profile(req: UserProfileRequest):
    if not req.uid:
        raise HTTPException(status_code=400, detail="Missing required fields")

    db = get_db()
    user = await db.users.find_one({"firebaseUid": req.uid})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "companyName": user.get("companyName")
    }

@router.post("/role")
async def get_or_set_role(req: UserRoleRequest):
    if not req.uid:
        raise HTTPException(status_code=400, detail="Missing required fields")

    db = get_db()
    user = await db.users.find_one({"firebaseUid": req.uid})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = {}
    if req.role:
        update_data["role"] = req.role
        user["role"] = req.role
    if req.companyName and req.companyName.strip():
        update_data["companyName"] = req.companyName.strip()
        user["companyName"] = req.companyName.strip()

    if update_data:
        await db.users.update_one({"firebaseUid": req.uid}, {"$set": update_data})

    return {
        "role": user.get("role"),
        "companyName": user.get("companyName"),
        "name": user.get("name"),
        "email": user.get("email")
    }
