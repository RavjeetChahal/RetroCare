#!/usr/bin/env python3
"""
Quick test to verify the service can start without errors.
Run this before deploying to catch import/startup issues.
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

print("Testing service startup...")
print("=" * 50)

# Test 1: Check Python version
print(f"✓ Python version: {sys.version}")

# Test 2: Check imports
try:
    print("\n1. Testing imports...")
    from main import app
    print("   ✓ main.py imports OK")
    
    from utils.audio import load_model, _model_loaded
    print("   ✓ utils.audio imports OK")
    
    from utils.scoring import cosine_similarity
    print("   ✓ utils.scoring imports OK")
    
except ImportError as e:
    print(f"   ✗ Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"   ✗ Error: {e}")
    sys.exit(1)

# Test 3: Check app initialization
try:
    print("\n2. Testing app initialization...")
    assert app is not None, "App is None"
    print("   ✓ App initialized")
except Exception as e:
    print(f"   ✗ App initialization error: {e}")
    sys.exit(1)

# Test 4: Check routes exist
try:
    print("\n3. Testing routes...")
    routes = [route.path for route in app.routes]
    assert "/" in routes, "Root route missing"
    assert "/health" in routes, "Health route missing"
    assert "/embed" in routes, "Embed route missing"
    assert "/compare" in routes, "Compare route missing"
    print(f"   ✓ All routes present: {', '.join(routes)}")
except Exception as e:
    print(f"   ✗ Route check error: {e}")
    sys.exit(1)

# Test 5: Check model loading function (don't actually load)
try:
    print("\n4. Testing model loading function...")
    from utils.audio import load_model
    import inspect
    assert inspect.isfunction(load_model), "load_model is not a function"
    print("   ✓ Model loading function exists")
except Exception as e:
    print(f"   ✗ Model loading check error: {e}")
    sys.exit(1)

print("\n" + "=" * 50)
print("✅ All startup tests passed!")
print("\nThe service should start successfully.")
print("If you still get 502 errors, check Render logs for runtime errors.")


