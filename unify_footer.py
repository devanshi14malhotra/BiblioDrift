import glob
import re

html_files = glob.glob('frontend/pages/*.html')

footer_elements = """

  <!-- Back to Top Button -->
  <button id="backToTop" class="btn-icon back-to-top" title="Back to Top" onclick="window.scrollTo({top: 0, behavior: 'smooth'});">
    <i class="fa-solid fa-arrow-up"></i>
  </button>

  <!-- Ambient Sanctuary UI -->
  <div class="ambient-sanctuary">
    <button id="ambientToggle" title="Ambient Sanctuary" aria-expanded="false" aria-controls="ambientPanel">
      <i class="fa-solid fa-leaf"></i>
    </button>
    <div id="ambientPanel" class="ambient-panel">
      <h3 style="color: var(--text-main) !important;">Ambient Sanctuary</h3>
      <div class="ambient-option">
        <span style="color: var(--text-main) !important;"><i class="fa-solid fa-cloud-rain"></i> Rainy Evening</span>
        <label class="switch">
          <input type="checkbox" id="rainToggle">
          <span class="slider"></span>
        </label>
      </div>
      <div class="ambient-option">
        <span style="color: var(--text-main) !important;"><i class="fa-solid fa-fire"></i> Cozy Fireplace</span>
        <label class="switch">
          <input type="checkbox" id="fireToggle">
          <span class="slider"></span>
        </label>
      </div>
      <div class="ambient-option">
        <span style="color: var(--text-main) !important;"><i class="fa-solid fa-water"></i> Calm Ocean Waves</span>
        <label class="switch">
          <input type="checkbox" id="oceanToggle">
          <span class="slider"></span>
        </label>
      </div>
      <div class="ambient-option">
        <span style="color: var(--text-main) !important;"><i class="fa-solid fa-bolt"></i> Stormy Rain</span>
        <label class="switch">
          <input type="checkbox" id="stormToggle">
          <span class="slider"></span>
        </label>
      </div>
      <div class="volume-control">
        <label for="ambientVolume" style="color: var(--text-main) !important;"><i class="fa-solid fa-volume-high"></i> Volume</label>
        <div class="range-wrap">
          <div class="range-track" aria-hidden="true"></div>
          <div class="range-fill" aria-hidden="true"></div>
          <input type="range" id="ambientVolume" min="0" max="1" step="0.1" value="0.5" style="width: 100%;">
        </div>
      </div>
    </div>
  </div>
"""

for fpath in html_files:
    if fpath.endswith('index.html') or fpath.endswith('chat.html'): 
        # index already has it, chat has a custom one in the header
        continue
        
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'ambient-sanctuary' not in content:
        # insert before the first script tag that comes after </main>
        # or just before </body>
        # Actually it's safer to just put it after </main>
        content = content.replace('</main>', '</main>' + footer_elements)
        
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Unified footer elements!")
