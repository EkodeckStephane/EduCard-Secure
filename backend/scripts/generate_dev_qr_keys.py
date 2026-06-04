from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.qr_service import generate_dev_keys
from app.services.qr_service import key_paths


def main() -> None:
    try:
        private_path, public_path, fingerprint = generate_dev_keys(overwrite=False)
    except FileExistsError:
        private_path, public_path = key_paths()
        print("Development QR keys already exist. Refusing to overwrite.")
        print(f"Private key: {private_path}")
        print(f"Public key: {public_path}")
        print(f"Git ignored: {private_path.parent}")
        return
    print(f"Private key: {private_path}")
    print(f"Public key: {public_path}")
    print(f"Public fingerprint: {fingerprint}")
    print(f"Git ignored: {private_path.parent}")


if __name__ == "__main__":
    main()
