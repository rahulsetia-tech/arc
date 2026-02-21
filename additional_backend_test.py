#!/usr/bin/env python3
"""
SUPERACRES Backend API Additional Tests
Testing remaining endpoints not covered in main test suite
"""

import requests
import json
import time
from datetime import datetime

# Use the production backend URL from frontend/.env
BASE_URL = "https://neon-running-game.preview.emergentagent.com/api"

def test_additional_endpoints():
    """Test additional endpoints using existing data from main tests"""
    
    # First create a test user and run (similar to main test)
    timestamp = str(int(time.time()))
    user_data = {
        "username": f"testrunner{timestamp}",
        "email": f"testrunner{timestamp}@superacres.com", 
        "password": "TestRunner123!"
    }
    
    print("🔍 Testing Additional Backend Endpoints")
    print("=" * 50)
    
    # Register user to get token
    response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
    if response.status_code != 200:
        print("❌ Failed to register user for additional tests")
        return
    
    data = response.json()
    token = data["token"]
    user_id = data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Start and end a run to get run data
    run_response = requests.post(f"{BASE_URL}/runs/start", json={}, headers=headers)
    if run_response.status_code != 200:
        print("❌ Failed to start run for additional tests")
        return
    
    run_id = run_response.json()["runId"]
    
    # End run with coordinates
    run_data = {
        "runId": run_id,
        "coordinates": [
            [-0.1278, 51.5074],
            [-0.1275, 51.5076], 
            [-0.127, 51.508],
            [-0.1265, 51.5082]
        ]
    }
    end_response = requests.post(f"{BASE_URL}/runs/end", json=run_data, headers=headers)
    if end_response.status_code != 200:
        print("❌ Failed to end run for additional tests")
        return
    
    print("✅ Setup completed for additional tests")
    
    # Test GET /runs/{user_id} - Get user runs
    try:
        response = requests.get(f"{BASE_URL}/runs/{user_id}", headers=headers)
        if response.status_code == 200:
            runs = response.json()
            print(f"✅ PASS: Get User Runs - Found {len(runs)} runs")
        else:
            print(f"❌ FAIL: Get User Runs - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ FAIL: Get User Runs - Error: {str(e)}")
    
    # Test GET /runs/detail/{run_id} - Get run detail
    try:
        response = requests.get(f"{BASE_URL}/runs/detail/{run_id}", headers=headers)
        if response.status_code == 200:
            run_detail = response.json()
            print(f"✅ PASS: Get Run Detail - Distance: {run_detail.get('distanceKm', 0)} km")
        else:
            print(f"❌ FAIL: Get Run Detail - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ FAIL: Get Run Detail - Error: {str(e)}")
    
    # Test GET /territories/user/{user_id} - Get user territories
    try:
        response = requests.get(f"{BASE_URL}/territories/user/{user_id}", headers=headers)
        if response.status_code == 200:
            territories = response.json()
            print(f"✅ PASS: Get User Territories - Found {len(territories)} territories")
        else:
            print(f"❌ FAIL: Get User Territories - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ FAIL: Get User Territories - Error: {str(e)}")
    
    # Test GET /leaderboard/local - Local leaderboard
    try:
        params = {"lat": 51.5074, "lng": -0.1278, "radius_km": 20}
        response = requests.get(f"{BASE_URL}/leaderboard/local", params=params, headers=headers)
        if response.status_code == 200:
            leaderboard = response.json()
            print(f"✅ PASS: Local Leaderboard - Found {len(leaderboard)} users")
        else:
            print(f"❌ FAIL: Local Leaderboard - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ FAIL: Local Leaderboard - Error: {str(e)}")
    
    # Test PUT /users/{user_id}/profile - Update profile
    try:
        update_data = {"username": f"updated_{timestamp}"}
        response = requests.put(f"{BASE_URL}/users/{user_id}/profile", json=update_data, headers=headers)
        if response.status_code == 200:
            updated_profile = response.json()
            print(f"✅ PASS: Update Profile - Username: {updated_profile.get('username')}")
        else:
            print(f"❌ FAIL: Update Profile - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ FAIL: Update Profile - Error: {str(e)}")
    
    print("=" * 50)
    print("🎯 Additional endpoint testing completed")

if __name__ == "__main__":
    test_additional_endpoints()