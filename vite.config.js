import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  base: '/',
  plugins: [vue()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  },
  
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "sass:math"; @use "sass:color"; @use "@/vars.scss" as *;`,
        api: 'modern-compiler'
      }
    }
  },
  
  server: {
    port: 8080,
    strictPort: false,
    open: false
  },
  
  build: {
    outDir: 'dist',
    assetsDir: 'static',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vuex'],
          'fontawesome': [
            '@fortawesome/fontawesome-svg-core',
            '@fortawesome/free-solid-svg-icons',
            '@fortawesome/free-brands-svg-icons',
            '@fortawesome/vue-fontawesome'
          ]
        },
        // Optimize asset filenames
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/webp|png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `static/img/[name]-[hash][extname]`;
          } else if (/woff2?|ttf|otf|eot/i.test(ext)) {
            return `static/fonts/[name]-[hash][extname]`;
          }
          return `static/[name]-[hash][extname]`;
        }
      }
    }
  },
  
  publicDir: 'public'
});
