import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
import_block = """from validators import (
    validate_request,
    validate_schema,
    validate_google_books_id,
    AnalyzeMoodRequest,
    MoodTagsRequest,
    MoodSearchRequest,
    VibeCheckRequest,
    GenerateNoteRequest,"""
content = re.sub(
    r'from validators import \(\s*validate_request,\s*validate_google_books_id,\s*AnalyzeMoodRequest,\s*MoodTagsRequest,\s*MoodSearchRequest,\s*GenerateNoteRequest,',
    import_block,
    content
)

# 2. Refactor existing validated routes
# Pattern to match:
# def handle_something():
#     ...
#     data = request.get_json(...)  (or request.json)
#     is_valid, validated_data = validate_request(Schema, data)
#     if not is_valid:
#         return jsonify(validated_data), 400

routes_to_fix = [
    ('AnalyzeMoodRequest', 'handle_analyze_mood', True),
    ('MoodTagsRequest', 'handle_mood_tags', True),
    ('MoodSearchRequest', 'handle_mood_search', True),
    ('CategoryBooksRequest', 'handle_category_books', True),
    ('GenerateNoteRequest', 'handle_generate_note', True),
    ('ChatRequest', 'handle_chat', True),
    ('AddToLibraryRequest', 'add_to_library', True),
    ('UpdateLibraryItemRequest', 'update_library_item', True),
    ('SyncLibraryRequest', 'sync_library', True),
    ('RegisterRequest', 'register', True),
    ('LoginRequest', 'login', True),
    ('ForgotPasswordRequest', 'forgot_password', True),
    ('ResetPasswordRequest', 'reset_password', True),
    ('SetGoalRequest', 'set_reading_goal', False),
    ('CollectionRequest', 'create_collection', False),
    ('UpdateCollectionRequest', 'update_collection', False),
    ('AddToCollectionRequest', 'add_to_collection', False),
    ('ReviewRequest', 'add_review', False),
    ('SetPriceAlertRequest', 'set_price_alert', False),
]

for schema, func_name, is_jsonify in routes_to_fix:
    # Add decorator and argument
    # Some functions have existing arguments, e.g., def update_library_item(item_id):
    # We replace `def func_name(...):` with `@validate_schema(Schema)\ndef func_name(..., validated_data):`
    # Wait, some have arguments, some don't.
    
    # We can match `def func_name(args):`
    # and replace with `@validate_schema(Schema)\ndef func_name(args, validated_data):`
    # But wait, if args is empty, we just put `validated_data`. If not empty, we append `, validated_data`.
    def repl_func_def(m):
        args = m.group(1)
        if args.strip() == '':
            new_args = 'validated_data'
        else:
            if 'validated_data' not in args:
                new_args = args + ', validated_data'
            else:
                new_args = args
        return f"@validate_schema({schema})\ndef {func_name}({new_args}):"
    
    content = re.sub(rf'def {func_name}\((.*?)\):', repl_func_def, content)

    # Remove the manual validation logic
    # The logic looks like:
    #         data = request.get_json(...)
    #         is_valid, ...
    #         if not is_valid:
    #             return ...
    
    validation_pattern = re.compile(
        rf'[ \t]*data = request\.(?:get_json\(.*?\)|json)\s*'
        rf'[ \t]*is_valid, validated_data = validate_request\({schema}, data\)\s*'
        rf'[ \t]*if not is_valid:\s*'
        rf'[ \t]*return .*?, 400\n',
        re.DOTALL
    )
    
    content = validation_pattern.sub('', content)


# 3. Refactor vibe-check (it had custom logic instead of validate_request)
content = re.sub(r'def handle_vibe_check\(\):', r'@validate_schema(VibeCheckRequest)\ndef handle_vibe_check(validated_data):', content)

vibe_check_validation_pattern = re.compile(
    r'[ \t]*data = request\.get_json\(\)\s*'
    r'[ \t]*# Safely validate input\s*'
    r"[ \t]*if not data or 'vibe_prompt' not in data:\s*"
    r'[ \t]*return missing_fields_error\(\["vibe_prompt"\]\)\s*'
    r"[ \t]*vibe_prompt = data\['vibe_prompt'\]\s*"
    r"[ \t]*count = data\.get\('count', 3\)",
    re.DOTALL
)

vibe_replacement = """        vibe_prompt = validated_data.vibe_prompt
        count = validated_data.count"""

content = vibe_check_validation_pattern.sub(vibe_replacement, content)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Refactoring complete.")
