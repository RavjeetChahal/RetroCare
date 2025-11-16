#!/bin/bash
# Test script for RetroCare Python Anomaly Detection Service
# Usage: ./test_service.sh [service_url]

SERVICE_URL="${1:-https://retrocare-python.onrender.com}"

echo "=========================================="
echo "Testing RetroCare Python Service"
echo "Service URL: $SERVICE_URL"
echo "=========================================="
echo ""

# Test 1: Root endpoint
echo "1. Testing root endpoint (/)..."
echo "   Command: curl -s $SERVICE_URL/"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$SERVICE_URL/")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Status: $HTTP_CODE"
    echo "   Response: $BODY"
else
    echo "   ❌ Status: $HTTP_CODE"
    echo "   Response: $BODY"
fi
echo ""

# Test 2: Health endpoint
echo "2. Testing health endpoint (/health)..."
echo "   Command: curl -s $SERVICE_URL/health"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$SERVICE_URL/health")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Status: $HTTP_CODE"
    echo "   Response: $BODY"
    
    # Parse JSON to check model status
    MODEL_LOADED=$(echo "$BODY" | grep -o '"model_loaded":[^,}]*' | cut -d: -f2)
    STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    echo ""
    echo "   Service Status: $STATUS"
    echo "   Model Loaded: $MODEL_LOADED"
    
    if [ "$MODEL_LOADED" = "true" ]; then
        echo "   ✅ Model is loaded and ready!"
    elif [ "$STATUS" = "loading" ]; then
        echo "   ⏳ Model is still loading..."
    else
        echo "   ⚠️  Model not loaded"
    fi
else
    echo "   ❌ Status: $HTTP_CODE"
    echo "   Response: $BODY"
fi
echo ""

# Test 3: Pretty JSON health check
echo "3. Health check (pretty JSON)..."
echo "   Command: curl -s $SERVICE_URL/health | python3 -m json.tool"
curl -s "$SERVICE_URL/health" | python3 -m json.tool 2>/dev/null || echo "   (JSON parsing failed or python3 not available)"
echo ""

# Test 4: Check if embed endpoint exists (will fail without model, but tests endpoint)
echo "4. Testing embed endpoint exists (/embed)..."
echo "   Command: curl -s -X POST $SERVICE_URL/embed -H 'Content-Type: application/json' -d '{\"audio_url\":\"https://example.com/test.wav\",\"sample_rate\":16000}'"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$SERVICE_URL/embed" \
    -H "Content-Type: application/json" \
    -d '{"audio_url":"https://example.com/test.wav","sample_rate":16000}')
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE" | head -3)

if [ "$HTTP_CODE" = "503" ]; then
    echo "   ⚠️  Status: $HTTP_CODE (Model not loaded - expected if still loading)"
    echo "   This is OK if model is still loading"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "   ❌ Status: $HTTP_CODE (Endpoint not found)"
else
    echo "   Status: $HTTP_CODE"
    echo "   Response: $BODY"
fi
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "✅ Root endpoint: Should return 200"
echo "✅ Health endpoint: Should return 200 (even during model loading)"
echo "✅ Service should respond immediately"
echo ""
echo "If all tests pass, the service is working correctly!"
echo ""


