"""Validate the configured Gemini API key without displaying the secret."""

from google import genai
from google.genai.errors import APIError

from deepeval.config.settings import get_settings


def main() -> int:
    secret = get_settings().GOOGLE_API_KEY
    key = secret.get_secret_value().strip() if secret else ""

    if not key:
        print("Gemini key check: FAILED (no key was saved)")
        return 1

    try:
        client = genai.Client(api_key=key)
        next(iter(client.models.list(config={"page_size": 1})))
    except APIError as exc:
        print(f"Gemini key check: FAILED (Google HTTP {exc.code})")
        print("Google says the saved value is not a valid Gemini API key.")
        print(f"Saved value length: {len(key)} characters")
        return 1
    except Exception as exc:
        print(f"Gemini key check: FAILED ({type(exc).__name__})")
        print("Google could not be reached to validate the key.")
        return 1

    print("Gemini key check: SUCCESS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
