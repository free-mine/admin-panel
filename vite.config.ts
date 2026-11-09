import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig(() => {
  const proxy = {
    '^/(v1(?:/|$)|health$|ready$)': {
      ws: true,
      target: 'http://127.0.0.1:5175',
    },
  }

  return {
    plugins: [solid()],
    server: { proxy, port: 5173, strictPort: true, host: '127.0.0.1' },
    preview: { proxy, port: 4173, strictPort: true, host: '127.0.0.1' },
  }
})
