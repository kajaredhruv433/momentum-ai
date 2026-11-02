import os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# Load backend environment variables
load_dotenv(Path(__file__).resolve().parent / "backend" / ".env")

api_key = os.getenv("BASETEN_API_KEY")
base_url = os.getenv("BASETEN_BASE_URL", "https://inference.baseten.co/v1")
model = os.getenv("BASETEN_MODEL", "meta-models/muse-spark-open-1026")

print(f"Baseten API Key configured: {bool(api_key and api_key != 'your-baseten-api-key')}")
print(f"Base URL: {base_url}")
print(f"Model: {model}")

if not api_key or api_key == "your-baseten-api-key":
    print("\n[!] Please put your real BASETEN_API_KEY in backend/.env to test live inference.")
else:
    client = OpenAI(base_url=base_url, api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Hello!"}],
    )
    print("\nModel response:")
    print(response.choices[0].message.content)
