# save as test_ai.py in the BiblioDrift folder
import os


from ai_service import llm_service, generate_book_note

print("LLM available:", llm_service.is_available())
print("Token budget:", llm_service.config["book_note_max_tokens"])

result = generate_book_note(
    description="A quiet novel about grief and small-town life",
    title="A Little Life",
    author="Hanya Yanagihara",
    vibe="rainy afternoon melancholy"
)
print(result)