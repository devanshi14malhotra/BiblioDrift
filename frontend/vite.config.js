import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'pages',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'pages/index.html'),
        app: resolve(__dirname, 'pages/app.html'),
        auth: resolve(__dirname, 'pages/auth.html'),
        chat: resolve(__dirname, 'pages/chat.html'),
        library: resolve(__dirname, 'pages/library.html'),
        profile: resolve(__dirname, 'pages/profile.html'),
        vault: resolve(__dirname, 'pages/vault.html'),
        404: resolve(__dirname, 'pages/404.html'),
        'privacy-policy': resolve(__dirname, 'pages/privacy-policy.html'),
        'request-book': resolve(__dirname, 'pages/request-book.html'),
        'terms-and-conditions': resolve(__dirname, 'pages/terms-and-conditions.html'),
        contributing: resolve(__dirname, 'pages/contributing.html'),
        contributors: resolve(__dirname, 'pages/contributors.html'),
        'community-stories': resolve(__dirname, 'pages/community-stories.html'),
        'nearby-bookstores': resolve(__dirname, 'pages/nearby-bookstores.html'),
        'spotify-playlists': resolve(__dirname, 'pages/spotify-playlists.html')
      }
    }
  }
});
