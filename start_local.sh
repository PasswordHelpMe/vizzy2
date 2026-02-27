#!/bin/bash

# Vizio TV API Local Startup Script (No Docker)

echo "🐍 Vizio TV API - Local Python Startup"
echo "======================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file with your TV configuration:"
    echo ""
    echo "VIZIO_IP=your_tv_ip_address"
    echo "VIZIO_PORT=7345"
    echo "VIZIO_AUTH_TOKEN=your_auth_token"
    echo ""
    echo "Example:"
    echo "VIZIO_IP=192.168.1.100"
    echo "VIZIO_PORT=7345"
    echo "VIZIO_AUTH_TOKEN=your_token_here"
    exit 1
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+"
    exit 1
fi

# Check Python version
python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "🐍 Using Python $python_version"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Start the API
echo "🚀 Starting Vizio TV API..."
echo "API will be available at: http://localhost:8000"
echo "API docs will be available at: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python main.py 