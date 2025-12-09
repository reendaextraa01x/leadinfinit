
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo (development/production)
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // A chave fornecida foi configurada aqui como padrão para garantir que funcione no Vercel
  const apiKey = env.API_KEY || "AIzaSyBYm1j6yzneb_kkl0RZJfwpfG2CRz8qUew";

  return {
    plugins: [react()],
    define: {
      // Isso substitui 'process.env.API_KEY' pelo valor real durante o build
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Evita o erro "process is not defined" no navegador
      'process.env': {} 
    }
  }
})
