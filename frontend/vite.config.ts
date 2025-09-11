import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@fhevm/hardhat-plugin', 'fhevmjs'],
    include: ['ethers'] // 明确包含 ethers
  },
  define: {
    global: 'globalThis', // 为 ethers 提供 global 定义
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process/browser',
      util: 'util'
    }
  },
  server: {
    port: 8383,
    host: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
})