import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import eslint from 'vite-plugin-eslint';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  const isProduction = mode === 'production';
  const isDevelopment = mode === 'development';
  
  return {
    plugins: [
      react({
        // React Fast Refresh
        fastRefresh: isDevelopment,
        // Babel configuration
        babel: {
          plugins: [
            // Emotion support for styled components
            ['@emotion/babel-plugin']
          ]
        }
      }),
      
      // ESLint integration
      eslint({
        cache: false,
        include: ['./src/**/*.ts', './src/**/*.tsx'],
        exclude: ['node_modules']
      }),
      
      // PWA Support
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Nexus - Teleconferencias Inteligente',
          short_name: 'Nexus',
          description: 'Plataforma de videoconferencias con IA avanzada',
          theme_color: '#1976d2',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\./,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache'
              }
            }
          ]
        }
      }),
      
      // Bundle analyzer (solo en modo analyze)
      mode === 'analyze' && visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true
      })
    ].filter(Boolean),
    
    // Path resolution
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@components': resolve(__dirname, './src/components'),
        '@pages': resolve(__dirname, './src/pages'),
        '@hooks': resolve(__dirname, './src/hooks'),
        '@services': resolve(__dirname, './src/services'),
        '@store': resolve(__dirname, './src/store'),
        '@types': resolve(__dirname, './src/types'),
        '@utils': resolve(__dirname, './src/utils'),
        '@assets': resolve(__dirname, './src/assets'),
        '@styles': resolve(__dirname, './src/styles')
      }
    },
    
    // Development server configuration
    server: {
      port: parseInt(env.FRONTEND_PORT || '3000'),
      host: true, // Para acceso desde Docker
      hmr: {
        port: 24678
      },
      proxy: {
        // Proxy API calls al backend
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false
        },
        // Proxy WebSocket connections
        '/socket.io': {
          target: env.VITE_WS_URL || 'http://localhost:8000',
          changeOrigin: true,
          ws: true
        }
      }
    },
    
    // Build configuration
    build: {
      target: 'esnext',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isDevelopment,
      minify: isProduction ? 'esbuild' : false,
      
      // Chunking strategy para mejor caching
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            'webrtc-vendor': ['simple-peer', 'webrtc-adapter'],
            'utils-vendor': ['lodash', 'date-fns', 'uuid'],
            'chart-vendor': ['recharts'],
            'motion-vendor': ['framer-motion']
          },
          // Asset naming
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const extType = assetInfo.name?.split('.').at(1);
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType ?? '')) {
              return 'assets/images/[name]-[hash][extname]';
            }
            if (/css/i.test(extType ?? '')) {
              return 'assets/css/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          }
        }
      },
      
      // Performance optimization
      chunkSizeWarningLimit: 1000
    },
    
    // Preview server (para testing del build)
    preview: {
      port: 4173,
      host: true
    },
    
    // Environment variables
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    },
    
    // CSS configuration
    css: {
      devSourcemap: isDevelopment,
      modules: {
        localsConvention: 'camelCase'
      },
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`
        }
      }
    },
    
    // Optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/material',
        '@emotion/react',
        '@emotion/styled',
        'socket.io-client',
        'simple-peer'
      ]
    },
    
    // Test configuration (para Vitest)
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
      css: true,
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/setupTests.ts',
          'src/**/*.stories.tsx',
          'src/**/*.test.tsx',
          'src/**/*.spec.tsx'
        ]
      }
    }
  };
});