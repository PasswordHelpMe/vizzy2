#!/bin/bash

# Vizio TV API Startup Script

echo "🎬 Vizio TV API Startup Script"
echo "================================"

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

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Docker detected"
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        echo "❌ Docker daemon is not running. Please start Docker Desktop."
        exit 1
    fi
    
    # Test Docker connectivity
    echo "Testing Docker connectivity..."
    if ! docker pull hello-world:latest &> /dev/null; then
        echo "⚠️  Docker networking issue detected. Trying alternative approach..."
        echo "Attempting to build with local cache..."
        
        # Try to build without pulling
        if docker-compose build --no-cache; then
            echo "✅ Build successful! Starting with Docker Compose..."
            docker-compose up
        else
            echo "❌ Docker build failed. Falling back to local Python..."
            echo "Installing dependencies..."
            pip install -r requirements.txt
            
            echo "Starting API with Python..."
            python main.py
        fi
    else
        echo "✅ Docker connectivity confirmed"
        echo "Starting API with Docker Compose..."
        docker-compose up --build
    fi
else
    echo "🐍 Docker not found - using local Python"
    echo "Installing dependencies..."
    pip install -r requirements.txt
    
    echo "Starting API with Python..."
    python main.py
fi 