#!/usr/bin/env python3
"""
Test script for the Vizio TV API
Run this to verify your API is working correctly
"""

import requests
import json
import time
import sys

def test_api(base_url="http://localhost:8000"):
    """Test the Vizio TV API endpoints"""
    
    print("Testing Vizio TV API...")
    print(f"Base URL: {base_url}")
    print("-" * 50)
    
    # Test 1: Health check
    print("1. Testing health check...")
    try:
        response = requests.get(f"{base_url}/health")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
        return False
    
    # Test 2: Get TV info
    print("\n2. Testing TV info...")
    try:
        response = requests.get(f"{base_url}/tv/info")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 3: Get power state
    print("\n3. Testing power state...")
    try:
        response = requests.get(f"{base_url}/tv/power")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 4: Get volume
    print("\n4. Testing volume...")
    try:
        response = requests.get(f"{base_url}/tv/volume")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 5: Get current input
    print("\n5. Testing current input...")
    try:
        response = requests.get(f"{base_url}/tv/input")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 6: Get available inputs
    print("\n6. Testing available inputs...")
    try:
        response = requests.get(f"{base_url}/tv/inputs")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 7: Get available apps
    print("\n7. Testing available apps...")
    try:
        response = requests.get(f"{base_url}/tv/apps")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 8: Get mute state
    print("\n8. Testing mute state...")
    try:
        response = requests.get(f"{base_url}/tv/mute")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n" + "=" * 50)
    print("Test completed!")
    print("If you see any errors, check your TV connection and environment variables.")
    print("Make sure your TV is powered on and connected to the same network.")

if __name__ == "__main__":
    # Allow custom base URL
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    test_api(base_url) 