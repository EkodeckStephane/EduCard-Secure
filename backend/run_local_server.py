from pathlib import Path
import sys

import uvicorn


ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)

sys.stdout = (LOG_DIR / "backend.local.out").open("a", encoding="utf-8")
sys.stderr = (LOG_DIR / "backend.local.err").open("a", encoding="utf-8")


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, log_level="info")

