import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  build: {
    // Génère des sourcemaps pour le débogage (désactiver en prod si nécessaire)
    sourcemap: false,
    
    // Optimisation du bundle
    rollupOptions: {
      output: {
        // Code-splitting pour de meilleurs temps de chargement
        manualChunks: {
          // Vendor chunks - librairies tierces
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['@headlessui/react', '@heroicons/react'],
          'vendor-utils': ['axios', 'papaparse']
        }
      }
    },
    
    // Limite de warning pour la taille des chunks
    chunkSizeWarningLimit: 600
  },
  
  // Optimisations pour le développement
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios']
  }
})
