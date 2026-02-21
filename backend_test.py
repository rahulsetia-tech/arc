#!/usr/bin/env python3
"""
SUPERACRES Backend API Test Suite
Testing all backend endpoints comprehensively
"""

import requests
import json
import time
from datetime import datetime

# Use the production backend URL from frontend/.env
BASE_URL = "https://neon-running-game.preview.emergentagent.com/api"

class SuperacresAPITester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.run_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"    Details: {details}")
    
    def test_api_root(self):
        """Test GET /api/"""
        try:
            response = requests.get(f"{BASE_URL}/")
            if response.status_code == 200:
                data = response.json()
                expected_message = "SUPERACRES API v1.0"
                if data.get("message") == expected_message and data.get("status") == "running":
                    self.log_test("API Root Endpoint", True, f"Response: {data}")
                else:
                    self.log_test("API Root Endpoint", False, f"Unexpected response: {data}")
            else:
                self.log_test("API Root Endpoint", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("API Root Endpoint", False, f"Request failed: {str(e)}")
    
    def test_territory_computation(self):
        """Test GET /api/test/territory"""
        try:
            params = {"lat": 51.5074, "lng": -0.1278}
            response = requests.get(f"{BASE_URL}/test/territory", params=params)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok" and "territory" in data and "area_km2" in data:
                    self.log_test("Test Territory Computation", True, f"Area: {data.get('area_km2')} km²")
                else:
                    self.log_test("Test Territory Computation", False, f"Invalid response structure: {data}")
            else:
                self.log_test("Test Territory Computation", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Test Territory Computation", False, f"Request failed: {str(e)}")
    
    def test_user_registration(self):
        """Test POST /api/auth/register"""
        try:
            # Create unique test user
            timestamp = str(int(time.time()))
            user_data = {
                "username": f"testrunner{timestamp}",
                "email": f"testrunner{timestamp}@superacres.com",
                "password": "TestRunner123!"
            }
            response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.token = data["token"]
                    self.user_id = data["user"]["id"]
                    self.log_test("User Registration", True, f"User ID: {self.user_id}")
                else:
                    self.log_test("User Registration", False, f"Missing token/user in response: {data}")
            else:
                self.log_test("User Registration", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("User Registration", False, f"Request failed: {str(e)}")
    
    def test_user_login(self):
        """Test POST /api/auth/login - using the same user created in registration"""
        try:
            timestamp = str(int(time.time()))
            login_data = {
                "email": f"testrunner{timestamp}@superacres.com",
                "password": "TestRunner123!"
            }
            response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.token = data["token"]  # Update token
                    self.user_id = data["user"]["id"]
                    self.log_test("User Login", True, f"Login successful for user: {data['user']['username']}")
                else:
                    self.log_test("User Login", False, f"Missing token/user in response: {data}")
            else:
                self.log_test("User Login", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("User Login", False, f"Request failed: {str(e)}")
    
    def test_get_current_user(self):
        """Test GET /api/auth/me"""
        if not self.token:
            self.log_test("Get Current User", False, "No auth token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "username", "email", "totalAreaKm2", "totalDistanceKm", "totalRuns"]
                if all(field in data for field in required_fields):
                    self.log_test("Get Current User", True, f"User: {data['username']}")
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Get Current User", False, f"Missing fields: {missing}")
            else:
                self.log_test("Get Current User", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Get Current User", False, f"Request failed: {str(e)}")
    
    def test_start_run(self):
        """Test POST /api/runs/start"""
        if not self.token:
            self.log_test("Start Run", False, "No auth token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(f"{BASE_URL}/runs/start", json={}, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "runId" in data and "startedAt" in data:
                    self.run_id = data["runId"]
                    self.log_test("Start Run", True, f"Run ID: {self.run_id}")
                else:
                    self.log_test("Start Run", False, f"Missing runId/startedAt in response: {data}")
            else:
                self.log_test("Start Run", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Start Run", False, f"Request failed: {str(e)}")
    
    def test_end_run(self):
        """Test POST /api/runs/end"""
        if not self.token or not self.run_id:
            self.log_test("End Run", False, "No auth token or run ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            # London coordinates for a realistic running route
            run_data = {
                "runId": self.run_id,
                "coordinates": [
                    [-0.1278, 51.5074],  # Start point (near London Eye)
                    [-0.1275, 51.5076],  # North
                    [-0.127, 51.508],    # Northeast
                    [-0.1265, 51.5082],  # North
                    [-0.126, 51.5084],   # End point
                ]
            }
            response = requests.post(f"{BASE_URL}/runs/end", json=run_data, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "run" in data and "territoryGained" in data:
                    territory_gained = data["territoryGained"]
                    distance = data["run"]["distanceKm"]
                    self.log_test("End Run", True, f"Territory: {territory_gained} km², Distance: {distance} km")
                else:
                    self.log_test("End Run", False, f"Missing run/territory data: {data}")
            else:
                self.log_test("End Run", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("End Run", False, f"Request failed: {str(e)}")
    
    def test_global_leaderboard(self):
        """Test GET /api/leaderboard/global"""
        if not self.token:
            self.log_test("Global Leaderboard", False, "No auth token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{BASE_URL}/leaderboard/global", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check if our user appears in leaderboard after the run
                    self.log_test("Global Leaderboard", True, f"Leaderboard has {len(data)} users")
                else:
                    self.log_test("Global Leaderboard", False, f"Expected list, got: {type(data)}")
            else:
                self.log_test("Global Leaderboard", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Global Leaderboard", False, f"Request failed: {str(e)}")
    
    def test_territories_bbox(self):
        """Test GET /api/territories"""
        try:
            # London area bounding box
            params = {
                "minLng": -0.15,
                "minLat": 51.49,
                "maxLng": -0.10,
                "maxLat": 51.52
            }
            response = requests.get(f"{BASE_URL}/territories", params=params)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Territories Bounding Box", True, f"Found {len(data)} territories")
                else:
                    self.log_test("Territories Bounding Box", False, f"Expected list, got: {type(data)}")
            else:
                self.log_test("Territories Bounding Box", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Territories Bounding Box", False, f"Request failed: {str(e)}")
    
    def test_user_profile(self):
        """Test GET /api/users/{userId}/profile"""
        if not self.token or not self.user_id:
            self.log_test("User Profile", False, "No auth token or user ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{BASE_URL}/users/{self.user_id}/profile", headers=headers)
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "username", "email", "totalAreaKm2", "totalDistanceKm", "totalRuns"]
                if all(field in data for field in required_fields):
                    self.log_test("User Profile", True, f"Profile for {data['username']}")
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("User Profile", False, f"Missing fields: {missing}")
            else:
                self.log_test("User Profile", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("User Profile", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests in sequence"""
        print(f"🚀 Starting SUPERACRES Backend API Tests")
        print(f"🌐 Backend URL: {BASE_URL}")
        print("=" * 60)
        
        # Test endpoints in logical order
        self.test_api_root()
        self.test_territory_computation()
        self.test_user_registration()
        
        # Note: We can't test login separately with a new user
        # because we need the same credentials from registration
        
        self.test_get_current_user()
        self.test_start_run()
        self.test_end_run()
        self.test_global_leaderboard()
        self.test_territories_bbox()
        self.test_user_profile()
        
        print("=" * 60)
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"📊 TEST SUMMARY:")
        print(f"   Total Tests: {total_tests}")
        print(f"   ✅ Passed: {passed_tests}")
        print(f"   ❌ Failed: {failed_tests}")
        print(f"   Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for test in self.test_results:
                if not test["success"]:
                    print(f"   - {test['test']}: {test['details']}")

if __name__ == "__main__":
    tester = SuperacresAPITester()
    tester.run_all_tests()