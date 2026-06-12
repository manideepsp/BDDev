#!/bin/bash
# Start Nexus BD — run both backend and frontend concurrently

echo "Starting Nexus BD..."
echo ""

# Backend
cd backend
if [ ! -d "venv" ]; then
  echo "Creating Python virtualenv..."
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q

if [ ! -f ".env" ]; then
  echo "⚠️  No .env found — copying .env.example"
  cp .env.example .env
  echo "📝 Edit backend/.env and add your ANTHROPIC_API_KEY, then re-run."
  exit 1
fi

echo "✅ Starting backend on http://localhost:8000"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Frontend
cd ../frontend
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

echo "✅ Starting frontend on http://localhost:3000"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "🚀 Nexus BD running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
