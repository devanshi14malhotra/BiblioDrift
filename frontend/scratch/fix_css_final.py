
import os
path = 'd:/Bibliodrift/BiblioDrift/frontend/css/style.css'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    fixed_tail = """
/* ============================================================ */
/* BASE UI COMPONENTS - STABLE VERSION 2.0 */
/* ============================================================ */

/* Force Back to Top Arrow */
.back-to-top {
    position: fixed !important;
    bottom: 6.5rem !important; /* Slightly adjusted to fit leaf below */
    right: 2rem !important;
    width: 3.5rem !important;
    height: 3.5rem !important;
    border-radius: 50% !important;
    background: var(--accent-gold) !important;
    color: white !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    z-index: 10000 !important;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
    cursor: pointer !important;
    border: none !important;
    transition: all 0.3s ease !important;
}

/* Ambient Sanctuary Wrapper Position */
.ambient-sanctuary {
    position: fixed !important;
    bottom: 2.5rem !important;
    right: 2.35rem !important; /* Centered relative to arrow */
    z-index: 10001 !important;
}

#ambientToggle {
    width: 2.8rem !important; /* Slightly smaller than arrow (3.5rem) */
    height: 2.8rem !important;
    border-radius: 50% !important;
    background: var(--header-bg) !important;
    color: var(--text-main) !important;
    border: 1px solid var(--glass-border) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
    transition: all 0.3s ease !important;
}

#ambientToggle:hover {
    background: var(--accent-gold) !important;
    color: white !important;
    transform: scale(1.05);
}

.ambient-panel {
    position: absolute;
    bottom: 60px;
    right: 0;
    width: 260px;
    background: #1e1a18 !important;
    background: var(--header-bg) !important;
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border) !important;
    border-radius: 15px;
    padding: 1.2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    display: none;
    flex-direction: column;
    gap: 1rem;
    z-index: 10002;
}

.ambient-panel.active {
    display: flex !important;
}

.ambient-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.ambient-option span {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.95rem;
}

.switch {
    position: relative;
    display: inline-block;
    width: 34px;
    height: 20px;
}

.switch input { opacity: 0; width: 0; height: 0; }

.slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: #444;
    transition: .4s;
    border-radius: 34px;
}

.slider:before {
    position: absolute;
    content: '';
    height: 14px; width: 14px;
    left: 3px; bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
}

input:checked + .slider { background-color: var(--accent-gold); }
input:checked + .slider:before { transform: translateX(14px); }
"""

    new_content = []
    for line in lines:
        if '/* ============================================================ */' in line:
            break
        new_content.append(line)

    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(new_content)
        f.write(fixed_tail)
    print("CSS Stabilized: Leaf Circle & Correct Positioning Applied.")
else:
    print("File not found.")
