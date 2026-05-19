import glob

html_files = glob.glob('frontend/pages/*.html')

for fpath in html_files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'pwa.css' not in content:
        # add it right after style.css
        content = content.replace('<link rel="stylesheet" href="../css/style.css">', '<link rel="stylesheet" href="../css/style.css">\n    <link rel="stylesheet" href="../css/pwa.css">')
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Added pwa.css to all pages!")
