import glob

html_files = glob.glob('frontend/pages/*.html')

for fpath in html_files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    modified = False
    
    if 'src="/js/ambient.js"' in content:
        content = content.replace('src="/js/ambient.js"', 'src="../js/ambient.js"')
        modified = True
        
    if content.count('src="../js/ambient.js"') > 1:
        # replace the first occurrence with nothing? Or just standard replace and add once
        # actually, just removing one is hard to write in a quick script
        pass
        
    if 'src="../js/ambient.js"' not in content:
        # insert before </body>
        content = content.replace('</body>', '    <script src="../js/ambient.js"></script>\n</body>')
        modified = True
        
    if modified:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Fixed ambient.js inclusions!")
