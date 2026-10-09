"""Launcher script for Clinical Voice Triage Application.
Starts the FastAPI backend and serves both Nurse Dashboard and Patient Intake Portal.
"""
import sys
import uvicorn
from backend.app.config import settings

# Ensure UTF-8 output encoding for Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

if __name__ == "__main__":
    print("=" * 70)
    print("Starting Multilingual Clinical Voice Triage Service")
    print(f"  Nurse Dashboard:        http://localhost:{settings.port}/")
    print(f"  Patient Intake Portal:   http://localhost:{settings.port}/patient.html")
    print(f"  API Health:              http://localhost:{settings.port}/api/health")
    print("=" * 70)
    uvicorn.run("backend.app.main:app", host=settings.host, port=settings.port, reload=False)
