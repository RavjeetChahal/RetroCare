#!/bin/bash

# Test script for anomaly detection
# This script will:
# 1. Check if Python service is running
# 2. Start Python service if not running
# 3. Run the anomaly detection tests

set -e

echo "🔍 RetroCare Anomaly Detection Test Runner"
echo "=========================================="
echo ""

# Check if Python service is running
PYTHON_SERVICE_URL="${PYTHON_SERVICE_URL:-http://localhost:8000}"
echo "Checking Python service at $PYTHON_SERVICE_URL..."

if curl -s "$PYTHON_SERVICE_URL/health" > /dev/null 2>&1; then
    echo "✅ Python service is running"
else
    echo "❌ Python service is not running"
    echo ""
    echo "Starting Python service..."
    echo "Please run this in a separate terminal:"
    echo ""
    echo "  cd python/anomaly-service"
    echo "  source venv/bin/activate  # or: venv\\Scripts\\activate on Windows"
    echo "  python main.py"
    echo ""
    echo "Or run it in the background:"
    echo "  cd python/anomaly-service && source venv/bin/activate && python main.py &"
    echo ""
    read -p "Press Enter once the Python service is running, or Ctrl+C to cancel..."
fi

# Check if Node.js dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Run the test script
echo ""
echo "Running anomaly detection tests..."
echo ""

npx tsx scripts/testAnomalyDetection.ts

