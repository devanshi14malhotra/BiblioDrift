from dotenv import load_dotenv
import os

# Load environment variables
loaded = load_dotenv()
print(f".env loaded: {loaded}")

if os.path.exists(".env"):
    print(".env file exists")
    with open(".env", "r") as f:
        content = f.read()
        print(f".env file size: {len(content)} bytes")
else:
    print(".env file DOES NOT EXIST")

from ai_service import llm_service

print("Testing LLM Service Setup...")

# Debug environment variables
print(f"OPENAI_API_KEY present: {'OPENAI_API_KEY' in os.environ}")
print(f"GROQ_API_KEY present: {'GROQ_API_KEY' in os.environ}")
print(f"GEMINI_API_KEY present: {'GEMINI_API_KEY' in os.environ}")

if llm_service.is_available():
    print("LLM Service is available!")
    if llm_service.openai_client:
        print("OpenAI client initialized.")
    if llm_service.groq_client:
        print("Groq client initialized.")
    if llm_service.gemini_client:
        print("Gemini client initialized.")
else:
    print("LLM Service is NOT available. Please check your API keys.")

print("\nDone.")