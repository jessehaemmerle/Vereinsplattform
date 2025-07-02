import requests
import json
import sys
import uuid
import time
from datetime import datetime

class VereinAPITester:
    def __init__(self, base_url="https://e7ac2d55-3a43-4368-bb35-863c6593dcf7.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.member_token = None
        self.verein_subdomain = None
        self.admin_email = None
        self.admin_password = None
        self.member_id = None
        self.member_email = None
        self.member_number = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, print_response=False):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if print_response:
                    try:
                        print(f"Response: {json.dumps(response.json(), indent=2)}")
                    except:
                        print(f"Response: {response.text}")
                return success, response.json() if response.text else {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Error: {response.json()}")
                except:
                    print(f"Response: {response.text}")
                return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_health(self):
        """Test API health endpoint"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )
        return success

    def test_create_verein(self):
        """Test creating a new Verein"""
        # Generate unique subdomain and admin email
        timestamp = int(time.time())
        self.verein_subdomain = f"test-verein-{timestamp}"
        self.admin_email = f"admin-{timestamp}@test.com"
        self.admin_password = "Test123!"
        
        data = {
            "name": f"Test Verein {timestamp}",
            "subdomain": self.verein_subdomain,
            "description": "Ein Test Verein für API Tests",
            "admin_email": self.admin_email,
            "admin_password": self.admin_password
        }
        
        success, response = self.run_test(
            "Create Verein",
            "POST",
            "vereine",
            200,
            data=data,
            print_response=True
        )
        
        return success

    def test_admin_login(self):
        """Test admin login"""
        data = {
            "email": self.admin_email,
            "password": self.admin_password,
            "subdomain": self.verein_subdomain
        }
        
        print(f"Attempting admin login with: {json.dumps(data, indent=2)}")
        
        # Add a small delay to ensure the Verein is fully created in the database
        print("Waiting 2 seconds for database to update...")
        time.sleep(2)
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "admin/login",
            200,
            data=data,
            print_response=True
        )
        
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"Admin token obtained: {self.admin_token[:10]}...")
            return True
        return False

    def test_get_verein_info(self):
        """Test getting Verein info as admin"""
        success, response = self.run_test(
            "Get Verein Info",
            "GET",
            "admin/verein",
            200,
            token=self.admin_token,
            print_response=True
        )
        return success

    def test_create_member(self):
        """Test creating a new member"""
        # Generate unique member data
        timestamp = int(time.time())
        self.member_email = f"member-{timestamp}@test.com"
        self.member_number = f"M{timestamp}"
        
        data = {
            "name": f"Test Member {timestamp}",
            "email": self.member_email,
            "membership_number": self.member_number,
            "membership_type": "Standard",
            "phone": "+43 123 456789",
            "address": "Teststraße 1, 1010 Wien",
            "fees_status": "Offen"
        }
        
        success, response = self.run_test(
            "Create Member",
            "POST",
            "admin/members",
            200,
            data=data,
            token=self.admin_token,
            print_response=True
        )
        
        if success and 'id' in response:
            self.member_id = response['id']
            print(f"Created member with ID: {self.member_id}")
            return True
        return False

    def test_get_members(self):
        """Test getting all members"""
        success, response = self.run_test(
            "Get All Members",
            "GET",
            "admin/members",
            200,
            token=self.admin_token,
            print_response=True
        )
        return success

    def test_get_member(self):
        """Test getting a specific member"""
        if not self.member_id:
            print("❌ No member ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Specific Member",
            "GET",
            f"admin/members/{self.member_id}",
            200,
            token=self.admin_token,
            print_response=True
        )
        return success

    def test_update_member(self):
        """Test updating a member"""
        if not self.member_id:
            print("❌ No member ID available for testing")
            return False
            
        data = {
            "fees_status": "Bezahlt",
            "membership_type": "Premium"
        }
        
        success, response = self.run_test(
            "Update Member",
            "PUT",
            f"admin/members/{self.member_id}",
            200,
            data=data,
            token=self.admin_token,
            print_response=True
        )
        return success

    def test_member_login(self):
        """Test member login"""
        data = {
            "email": self.member_email,
            "membership_number": self.member_number,
            "subdomain": self.verein_subdomain
        }
        
        success, response = self.run_test(
            "Member Login",
            "POST",
            "member/login",
            200,
            data=data,
            print_response=True
        )
        
        if success and 'token' in response:
            self.member_token = response['token']
            print(f"Member token obtained: {self.member_token[:10]}...")
            return True
        return False

    def test_get_member_profile(self):
        """Test getting member profile"""
        if not self.member_token:
            print("❌ No member token available for testing")
            return False
            
        success, response = self.run_test(
            "Get Member Profile",
            "GET",
            "member/profile",
            200,
            token=self.member_token,
            print_response=True
        )
        return success

    def test_get_member_verein(self):
        """Test getting verein info as member"""
        if not self.member_token:
            print("❌ No member token available for testing")
            return False
            
        success, response = self.run_test(
            "Get Verein Info as Member",
            "GET",
            "member/verein",
            200,
            token=self.member_token,
            print_response=True
        )
        return success

    def test_delete_member(self):
        """Test deleting a member"""
        if not self.member_id:
            print("❌ No member ID available for testing")
            return False
            
        success, response = self.run_test(
            "Delete Member",
            "DELETE",
            f"admin/members/{self.member_id}",
            200,
            token=self.admin_token,
            print_response=True
        )
        return success

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🚀 Starting API Tests for Verein Management System")
        print(f"Base URL: {self.base_url}")
        
        # Basic API health check
        self.test_api_health()
        
        # Verein registration and admin login
        if not self.test_create_verein():
            print("❌ Failed to create Verein, stopping tests")
            return
            
        if not self.test_admin_login():
            print("❌ Failed to login as admin, stopping tests")
            return
            
        self.test_get_verein_info()
        
        # Member management
        if not self.test_create_member():
            print("❌ Failed to create member, stopping tests")
            return
            
        self.test_get_members()
        self.test_get_member()
        self.test_update_member()
        
        # Member login and portal
        if not self.test_member_login():
            print("❌ Failed to login as member, stopping tests")
            return
            
        self.test_get_member_profile()
        self.test_get_member_verein()
        
        # Cleanup
        self.test_delete_member()
        
        # Print results
        print("\n📊 Test Results:")
        print(f"Tests passed: {self.tests_passed}/{self.tests_run} ({self.tests_passed/self.tests_run*100:.1f}%)")
        
        if self.tests_passed == self.tests_run:
            print("✅ All tests passed!")
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")

def main():
    tester = VereinAPITester()
    tester.run_all_tests()
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())