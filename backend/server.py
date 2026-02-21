from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from bson import ObjectId
from jose import JWTError, jwt
from passlib.context import CryptContext
from shapely.geometry import shape, mapping, LineString as ShapelyLine, Polygon as ShapelyPolygon, MultiPolygon
from shapely.ops import transform, unary_union
from pyproj import Transformer
import hashlib
import math
import json
import os
import logging
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Auth config
SECRET_KEY = os.environ.get("SECRET_KEY", "superacres-secret-2025-game")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# FastAPI app
app = FastAPI(title="SUPERACRES API")
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ============================================================
# GEO UTILITIES
# ============================================================

def geojson_to_list(obj):
    """Recursively convert tuples to lists for JSON serialization."""
    if isinstance(obj, tuple):
        return [geojson_to_list(item) for item in obj]
    elif isinstance(obj, list):
        return [geojson_to_list(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: geojson_to_list(v) for k, v in obj.items()}
    return obj


def shapely_to_geojson(geom):
    """Convert shapely geometry to GeoJSON dict with lists."""
    return geojson_to_list(mapping(geom))


def buffer_route_to_polygon(coordinates: List[List[float]], buffer_km: float = 0.05) -> Optional[Dict]:
    """Create a territory polygon by buffering a route linestring.
    coordinates: [[lng, lat], ...] in GeoJSON order
    Returns GeoJSON Polygon dict.
    """
    if not coordinates or len(coordinates) < 2:
        logger.warning("Not enough coordinates for buffer")
        return None
    try:
        line = ShapelyLine(coordinates)
        # Project to Web Mercator (meters) for accurate buffer
        to_mercator = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
        to_wgs84 = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
        line_m = transform(to_mercator.transform, line)
        buffered_m = line_m.buffer(buffer_km * 1000)  # km to meters
        buffered_wgs84 = transform(to_wgs84.transform, buffered_m)
        return shapely_to_geojson(buffered_wgs84)
    except Exception as e:
        logger.error(f"Buffer error: {e}")
        return None


def calculate_area_km2(geojson_polygon: Dict) -> float:
    """Calculate area of a GeoJSON polygon in km²."""
    try:
        geom = shape(geojson_polygon)
        to_equal_area = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True)
        projected = transform(to_equal_area.transform, geom)
        return projected.area / 1_000_000  # m² to km²
    except Exception as e:
        logger.error(f"Area calc error: {e}")
        return 0.0


def haversine_distance(coord1: List[float], coord2: List[float]) -> float:
    """Calculate distance between two [lng, lat] points in km."""
    R = 6371
    lat1, lon1 = math.radians(coord1[1]), math.radians(coord1[0])
    lat2, lon2 = math.radians(coord2[1]), math.radians(coord2[0])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(max(0, a)))


def calculate_route_distance_km(coordinates: List[List[float]]) -> float:
    """Total distance of a route in km."""
    total = 0.0
    for i in range(len(coordinates) - 1):
        total += haversine_distance(coordinates[i], coordinates[i + 1])
    return total


def user_color(user_id: str) -> str:
    """Generate a unique HSL color string from a user ID."""
    hash_val = int(hashlib.md5(str(user_id).encode()).hexdigest()[:8], 16)
    hue = hash_val % 360
    return f"hsl({hue}, 70%, 55%)"


# ============================================================
# AUTH UTILITIES
# ============================================================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, username: str) -> str:
    data = {
        "sub": user_id,
        "username": username,
        "exp": datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    }
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "").strip()
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        username = payload.get("username")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"user_id": user_id, "username": username}
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token error: {str(e)}")


# ============================================================
# SERIALIZATION
# ============================================================

def serialize_doc(doc: Dict) -> Dict:
    """Convert MongoDB document for API response."""
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == '_id':
            result['id'] = str(value)
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [serialize_doc(v) if isinstance(v, dict) else (str(v) if isinstance(v, ObjectId) else v) for v in value]
        else:
            result[key] = value
    return result


# ============================================================
# PYDANTIC MODELS
# ============================================================

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class StartRunRequest(BaseModel):
    pass


class EndRunRequest(BaseModel):
    runId: str
    coordinates: List[List[float]]  # [[lng, lat], ...]


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    avatarUrl: Optional[str] = None


# ============================================================
# STARTUP: Create indexes
# ============================================================

@app.on_event("startup")
async def startup_event():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("username")
        await db.territories.create_index([("polygon", "2dsphere")])
        await db.runs.create_index([("routeCoordinates", "2dsphere")])
        await db.runs.create_index("userId")
        await db.territories.create_index("userId")
        logger.info("MongoDB indexes created successfully")
    except Exception as e:
        logger.error(f"Index creation error: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ============================================================
# AUTH ROUTES
# ============================================================

@api_router.post("/auth/register")
async def register(req: RegisterRequest):
    # Check if user exists
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    existing_username = await db.users.find_one({"username": req.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Create user
    user = {
        "username": req.username,
        "email": req.email,
        "passwordHash": hash_password(req.password),
        "totalAreaKm2": 0.0,
        "totalDistanceKm": 0.0,
        "totalRuns": 0,
        "globalRank": 0,
        "color": "",  # will be set after insert
        "createdAt": datetime.utcnow()
    }
    result = await db.users.insert_one(user)
    user_id = str(result.inserted_id)

    # Set color based on user_id
    color = user_color(user_id)
    await db.users.update_one({"_id": result.inserted_id}, {"$set": {"color": color}})

    token = create_access_token(user_id, req.username)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": req.username,
            "email": req.email,
            "color": color,
            "totalAreaKm2": 0.0,
            "totalDistanceKm": 0.0,
            "totalRuns": 0
        }
    }


@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(req.password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id = str(user["_id"])
    token = create_access_token(user_id, user["username"])
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": user["username"],
            "email": user["email"],
            "color": user.get("color", user_color(user_id)),
            "totalAreaKm2": user.get("totalAreaKm2", 0.0),
            "totalDistanceKm": user.get("totalDistanceKm", 0.0),
            "totalRuns": user.get("totalRuns", 0)
        }
    }


@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = str(user["_id"])
    return {
        "id": user_id,
        "username": user["username"],
        "email": user["email"],
        "color": user.get("color", user_color(user_id)),
        "totalAreaKm2": user.get("totalAreaKm2", 0.0),
        "totalDistanceKm": user.get("totalDistanceKm", 0.0),
        "totalRuns": user.get("totalRuns", 0),
        "globalRank": user.get("globalRank", 0),
        "createdAt": user["createdAt"].isoformat() if isinstance(user.get("createdAt"), datetime) else str(user.get("createdAt", ""))
    }


# ============================================================
# RUN ROUTES
# ============================================================

@api_router.post("/runs/start")
async def start_run(current_user: dict = Depends(get_current_user)):
    run = {
        "userId": ObjectId(current_user["user_id"]),
        "username": current_user["username"],
        "status": "active",
        "routeCoordinates": None,
        "territoryPolygon": None,
        "distanceKm": 0.0,
        "durationSeconds": 0,
        "avgPaceMinPerKm": 0.0,
        "territoryGainedKm2": 0.0,
        "territoryStolenFrom": [],
        "startedAt": datetime.utcnow(),
        "endedAt": None
    }
    result = await db.runs.insert_one(run)
    return {"runId": str(result.inserted_id), "startedAt": run["startedAt"].isoformat()}


@api_router.post("/runs/end")
async def end_run(req: EndRunRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    username = current_user["username"]

    # Validate run
    run = await db.runs.find_one({"_id": ObjectId(req.runId), "userId": ObjectId(user_id)})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    coordinates = req.coordinates  # [[lng, lat], ...]
    if len(coordinates) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 coordinates")

    # Calculate stats
    distance_km = calculate_route_distance_km(coordinates)
    ended_at = datetime.utcnow()
    duration_seconds = int((ended_at - run["startedAt"]).total_seconds())
    avg_pace = (duration_seconds / 60) / distance_km if distance_km > 0 else 0.0

    # Create territory polygon
    new_polygon_geojson = buffer_route_to_polygon(coordinates, buffer_km=0.05)
    if not new_polygon_geojson:
        raise HTTPException(status_code=400, detail="Could not compute territory polygon")

    territory_gained_km2 = calculate_area_km2(new_polygon_geojson)
    new_shape = shape(new_polygon_geojson)

    # Find intersecting territories from OTHER users
    stolen_from = []
    try:
        cursor = db.territories.find({
            "polygon": {
                "$geoIntersects": {
                    "$geometry": new_polygon_geojson
                }
            },
            "userId": {"$ne": ObjectId(user_id)}
        })
        other_territories = await cursor.to_list(length=200)

        for territory in other_territories:
            their_shape = shape(territory["polygon"])
            # Subtract overlap from their territory
            try:
                remaining = their_shape.difference(new_shape)
                stolen_area_km2 = calculate_area_km2(shapely_to_geojson(their_shape.intersection(new_shape)))

                if remaining.is_empty or remaining.area < 1e-10:
                    # Completely stolen - delete their territory
                    await db.territories.delete_one({"_id": territory["_id"]})
                else:
                    # Partially stolen - update their territory
                    remaining_geojson = shapely_to_geojson(remaining)
                    remaining_area = calculate_area_km2(remaining_geojson)
                    await db.territories.update_one(
                        {"_id": territory["_id"]},
                        {"$set": {
                            "polygon": remaining_geojson,
                            "areaKm2": remaining_area,
                            "lastUpdatedAt": datetime.utcnow()
                        }}
                    )

                # Update previous owner's total area
                if stolen_area_km2 > 0:
                    await db.users.update_one(
                        {"_id": territory["userId"]},
                        {"$inc": {"totalAreaKm2": -stolen_area_km2}}
                    )
                    stolen_from.append({
                        "userId": str(territory["userId"]),
                        "username": territory.get("username", "unknown"),
                        "areaKm2": round(stolen_area_km2, 6)
                    })
            except Exception as e:
                logger.error(f"Territory difference error: {e}")
                continue
    except Exception as e:
        logger.error(f"Territory query error: {e}")

    # Merge with user's existing territories if adjacent/overlapping
    user_color_str = user_color(user_id)
    try:
        user_territories_cursor = db.territories.find({"userId": ObjectId(user_id)})
        user_territories = await user_territories_cursor.to_list(length=500)

        final_shape = new_shape
        territory_ids_to_delete = []

        for ut in user_territories:
            ut_shape = shape(ut["polygon"])
            if ut_shape.intersects(final_shape) or ut_shape.distance(final_shape) < 0.001:
                final_shape = unary_union([final_shape, ut_shape])
                territory_ids_to_delete.append(ut["_id"])

        # Delete old user territories that were merged
        if territory_ids_to_delete:
            await db.territories.delete_many({"_id": {"$in": territory_ids_to_delete}})

        final_polygon_geojson = shapely_to_geojson(final_shape)
        final_area_km2 = calculate_area_km2(final_polygon_geojson)

    except Exception as e:
        logger.error(f"Territory union error: {e}")
        final_polygon_geojson = new_polygon_geojson
        final_area_km2 = territory_gained_km2

    # Save new territory
    territory_doc = {
        "userId": ObjectId(user_id),
        "username": username,
        "polygon": final_polygon_geojson,
        "areaKm2": final_area_km2,
        "color": user_color_str,
        "capturedAt": datetime.utcnow(),
        "lastUpdatedAt": datetime.utcnow()
    }
    territory_result = await db.territories.insert_one(territory_doc)

    # Update run record
    route_geojson = {"type": "LineString", "coordinates": coordinates}
    await db.runs.update_one(
        {"_id": ObjectId(req.runId)},
        {"$set": {
            "status": "completed",
            "routeCoordinates": route_geojson,
            "territoryPolygon": final_polygon_geojson,
            "distanceKm": round(distance_km, 3),
            "durationSeconds": duration_seconds,
            "avgPaceMinPerKm": round(avg_pace, 2),
            "territoryGainedKm2": round(territory_gained_km2, 6),
            "territoryStolenFrom": stolen_from,
            "endedAt": ended_at
        }}
    )

    # Update user stats
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {
            "totalAreaKm2": territory_gained_km2,
            "totalDistanceKm": distance_km,
            "totalRuns": 1
        }}
    )

    # Update global ranks
    await update_global_ranks()

    return {
        "run": {
            "id": req.runId,
            "distanceKm": round(distance_km, 3),
            "durationSeconds": duration_seconds,
            "avgPaceMinPerKm": round(avg_pace, 2),
            "territoryGainedKm2": round(territory_gained_km2, 6),
            "territoryStolenFrom": stolen_from,
            "territoryPolygon": final_polygon_geojson,
            "routeCoordinates": route_geojson
        },
        "territoryGained": round(territory_gained_km2, 6),
        "territoryStolenFrom": stolen_from
    }


async def update_global_ranks():
    """Recalculate global ranks based on totalAreaKm2."""
    try:
        pipeline = [
            {"$sort": {"totalAreaKm2": -1}},
            {"$group": {"_id": None, "users": {"$push": {"_id": "$_id", "area": "$totalAreaKm2"}}}}
        ]
        result = await db.users.aggregate(pipeline).to_list(1)
        if result:
            users = result[0]["users"]
            for i, u in enumerate(users):
                await db.users.update_one(
                    {"_id": u["_id"]},
                    {"$set": {"globalRank": i + 1}}
                )
    except Exception as e:
        logger.error(f"Rank update error: {e}")


@api_router.get("/runs/{user_id}")
async def get_user_runs(user_id: str, current_user: dict = Depends(get_current_user)):
    cursor = db.runs.find(
        {"userId": ObjectId(user_id), "status": "completed"},
        sort=[("endedAt", -1)],
        limit=50
    )
    runs = await cursor.to_list(length=50)
    return [serialize_doc(r) for r in runs]


@api_router.get("/runs/detail/{run_id}")
async def get_run_detail(run_id: str, current_user: dict = Depends(get_current_user)):
    run = await db.runs.find_one({"_id": ObjectId(run_id)})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return serialize_doc(run)


# ============================================================
# TERRITORY ROUTES
# ============================================================

@api_router.get("/territories")
async def get_territories(
    minLng: float = Query(...),
    minLat: float = Query(...),
    maxLng: float = Query(...),
    maxLat: float = Query(...)
):
    """Get all territories within a bounding box."""
    try:
        query = {
            "polygon": {
                "$geoIntersects": {
                    "$geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [minLng, minLat],
                            [maxLng, minLat],
                            [maxLng, maxLat],
                            [minLng, maxLat],
                            [minLng, minLat]
                        ]]
                    }
                }
            }
        }
        cursor = db.territories.find(query, limit=200)
        territories = await cursor.to_list(length=200)
        return [serialize_doc(t) for t in territories]
    except Exception as e:
        logger.error(f"Territory fetch error: {e}")
        return []


@api_router.get("/territories/user/{user_id}")
async def get_user_territories(user_id: str, current_user: dict = Depends(get_current_user)):
    cursor = db.territories.find({"userId": ObjectId(user_id)})
    territories = await cursor.to_list(length=500)
    return [serialize_doc(t) for t in territories]


# ============================================================
# LEADERBOARD ROUTES
# ============================================================

@api_router.get("/leaderboard/global")
async def get_global_leaderboard(current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$sort": {"totalAreaKm2": -1}},
        {"$limit": 50},
        {"$project": {
            "username": 1,
            "totalAreaKm2": 1,
            "totalDistanceKm": 1,
            "totalRuns": 1,
            "globalRank": 1,
            "color": 1,
            "createdAt": 1
        }}
    ]
    users = await db.users.aggregate(pipeline).to_list(50)
    result = []
    for i, u in enumerate(users):
        result.append({
            "rank": i + 1,
            "id": str(u["_id"]),
            "username": u["username"],
            "totalAreaKm2": round(u.get("totalAreaKm2", 0), 4),
            "totalDistanceKm": round(u.get("totalDistanceKm", 0), 2),
            "totalRuns": u.get("totalRuns", 0),
            "color": u.get("color", "")
        })
    return result


@api_router.get("/leaderboard/local")
async def get_local_leaderboard(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(default=20),
    current_user: dict = Depends(get_current_user)
):
    """Get leaderboard for users with territory near a location."""
    # Query territories near the point using $geoIntersects
    pipeline = [
        {"$match": {
            "polygon": {
                "$geoIntersects": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [lng, lat]
                    }
                }
            }
        }},
        {"$group": {"_id": "$userId", "totalArea": {"$sum": "$areaKm2"}}},
        {"$sort": {"totalArea": -1}},
        {"$limit": 50}
    ]
    
    # Execute aggregation to get userId and totalArea
    agg_results = await db.territories.aggregate(pipeline).to_list(100)
    
    # Now fetch full user details for each userId
    result = []
    for idx, item in enumerate(agg_results):
        user_id = item["_id"]
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user:
            result.append({
                "rank": idx + 1,
                "id": str(user["_id"]),
                "username": user["username"],
                "totalAreaKm2": item["totalArea"],
                "totalDistanceKm": user.get("totalDistanceKm", 0.0),
                "totalRuns": user.get("totalRuns", 0),
                "color": user.get("color", user_color(str(user["_id"])))
            })
    
    return result


# ============================================================
# USER PROFILE ROUTES
# ============================================================

@api_router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    uid = str(user["_id"])
    return {
        "id": uid,
        "username": user["username"],
        "email": user.get("email", ""),
        "color": user.get("color", user_color(uid)),
        "totalAreaKm2": round(user.get("totalAreaKm2", 0), 4),
        "totalDistanceKm": round(user.get("totalDistanceKm", 0), 2),
        "totalRuns": user.get("totalRuns", 0),
        "globalRank": user.get("globalRank", 0),
        "createdAt": user["createdAt"].isoformat() if isinstance(user.get("createdAt"), datetime) else ""
    }


@api_router.put("/users/{user_id}/profile")
async def update_user_profile(
    user_id: str,
    req: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user)
):
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    update_data = {}
    if req.username:
        update_data["username"] = req.username
    if req.avatarUrl:
        update_data["avatarUrl"] = req.avatarUrl

    if update_data:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})

    return await get_user_profile(user_id, current_user)


# ============================================================
# TEST ROUTE
# ============================================================

@api_router.get("/test/territory")
async def test_territory(
    lat: float = Query(default=51.5074),
    lng: float = Query(default=-0.1278)
):
    """Test territory computation with a fake square route."""
    delta = 0.001  # ~100m
    # Create a small square route
    coordinates = [
        [lng, lat],
        [lng + delta, lat],
        [lng + delta, lat + delta],
        [lng, lat + delta],
        [lng, lat]
    ]

    polygon = buffer_route_to_polygon(coordinates, buffer_km=0.05)
    if not polygon:
        return {"error": "Could not compute territory"}

    area_km2 = calculate_area_km2(polygon)
    distance_km = calculate_route_distance_km(coordinates)

    return {
        "status": "ok",
        "input": {"lat": lat, "lng": lng},
        "route": {"type": "LineString", "coordinates": coordinates},
        "territory": polygon,
        "area_km2": round(area_km2, 6),
        "route_distance_km": round(distance_km, 3),
        "message": f"Territory of {round(area_km2, 4)} km² computed successfully"
    }


@api_router.get("/")
async def root():
    return {"message": "SUPERACRES API v1.0", "status": "running"}


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
