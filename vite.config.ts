import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente locais
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // LÓGICA DE PRIORIDADE DA CHAVE DE API (BLINDAGEM):
  // 1. process.env.API_KEY (Vercel Production)
  // 2. env.API_KEY (Arquivo .env local)
  // 3. Fallback Hardcoded (Segurança para testes rápidos)
  const apiKey = process.env.API_KEY || env.API_KEY || "AIzaSyBYm1j6yzneb_kkl0RZJfwpfG2CRz8qUew";

  console.log(`[Vite Build] Modo: ${mode}`);
  console.log(`[Vite Build] API Key detectada: ${apiKey ? 'Sim (Oculta)' : 'NÃO (Erro Crítico)'}`);

  return {
    plugins: [react()],
    define: {
      // Injeta a chave no código final do navegador de forma segura
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Garante que o objeto process.env exista para evitar crash
      'process.env': {} 
    },
    build: {
      // Otimizações para evitar erros de memória no Vercel
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
          output: {
              manualChunks: {
                  vendor: ['react', 'react-dom', '@google/genai']
              }
          }
      }
    }
  }
})