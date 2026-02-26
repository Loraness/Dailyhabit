import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: [
        "**/src-tauri/**", 
        "**/*.db",          // Игнорируем саму базу
        "**/*.db-journal",  // Игнорируем временный журнал SQLite
        "**/*.db-wal",      // Игнорируем WAL-файлы
        "**/*.db-shm"       // Игнорируем файлы разделяемой памяти
      ], 
    },
  },
}));
