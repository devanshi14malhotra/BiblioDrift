const STORAGE_KEYS = {
  CHAT_HISTORY: "bibliodrift_chat_history",
  COMMUNITY_STORIES: "bibliodrift_community_stories",
  READING_HEATMAP: "reading_heatmap",
  MOOD_THEME: "bibliodrift_mood",
  THEME: "bibliodrift_theme",
};

Object.freeze(STORAGE_KEYS);
export function getStorageData(key, fallback = null) {
  try {
    const data = localStorage.getItem(key);

    if (!data) {
      return fallback;
    }

    return JSON.parse(data);
  } catch (error) {
    console.error(`Storage parse error (${key}):`, error);
    return fallback;
  }
}

export function saveStorageData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Storage save error (${key}):`, error);
    return false;
  }
}

export function removeStorageData(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Storage remove error (${key}):`, error);
    return false;
  }
}
export function subscribeToStorage(callback) {
  window.addEventListener("storage", callback);
}
window.addEventListener('storage', (event) => {
  console.log('Storage updated:', event.key);
});

export { STORAGE_KEYS };