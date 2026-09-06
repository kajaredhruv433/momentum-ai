from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
from backend.config import MONGODB_URI, DB_NAME

client = None
db = None

def get_client():
    global client
    if client is None:
        client = AsyncIOMotorClient(MONGODB_URI)
    return client

def get_db():
    global db
    if db is None:
        c = get_client()
        db = c[DB_NAME]
    return db

def serialize_doc(doc: dict) -> dict:
    if not doc:
        return doc
    result = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
            if k == "_id":
                result["id"] = str(v)
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        elif isinstance(v, dict):
            result[k] = serialize_doc(v)
        elif isinstance(v, list):
            result[k] = [serialize_doc(item) if isinstance(item, dict) else (str(item) if isinstance(item, ObjectId) else (item.isoformat() if isinstance(item, datetime) else item)) for item in v]
        else:
            result[k] = v
    if "_id" in result and "id" not in result:
        result["id"] = str(result["_id"])
    return result

def serialize_docs(docs: list) -> list:
    return [serialize_doc(d) for d in docs]
