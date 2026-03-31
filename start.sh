#!/bin/bash
# UCSD Course Browser — one-command startup
# Usage: ./start.sh

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "Starting UCSD Course Browser..."

# Activate venv
if [ ! -d ".venv" ]; then
  echo "Creating Python venv..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install fastapi uvicorn requests beautifulsoup4 lxml
else
  source .venv/bin/activate
fi

# Install frontend deps if needed
if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

# Start FastAPI backend
echo "Starting backend on :8000..."
python server.py &
BACKEND_PID=$!

# Start Vite dev server
echo "Starting frontend on :5173..."
cd frontend && npx vite &
FRONTEND_PID=$!
cd "$DIR"

# Wait for servers to be ready
sleep 3

# Open browser
echo "Opening browser..."
open http://localhost:5173

echo ""
echo "Backend:  http://localhost:8000  (PID $BACKEND_PID)"
echo "Frontend: http://localhost:5173  (PID $FRONTEND_PID)"
echo ""
echo "Press Ctrl+C to stop both servers."

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
