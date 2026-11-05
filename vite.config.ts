import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 直播间监听桥接服务：在 server 目录运行 python -m dy.main
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      // 火山 TTS 不允许浏览器跨域预检，开发环境通过同源代理转发请求。
      '/volcengine-tts': {
        target: 'https://openspeech.bytedance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/volcengine-tts/, '/api/v3/tts/unidirectional'),
      },
      // 方舟（豆包）同样不允许浏览器跨域，开发环境走同源代理。
      '/volcengine-ark': {
        target: 'https://ark.cn-beijing.volces.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/volcengine-ark/, '/api/v3'),
      },
    },
  },
})
