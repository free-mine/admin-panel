import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

const proxy = {
  '^/(v1(?:/|$)|health$|ready$)': {
    ws: true,
    target: 'http://127.0.0.1:5175',
  },
}

export default defineConfig({
  plugins: [solid()],
  server: { proxy, port: 5173, strictPort: true, host: 'localhost' },
  preview: { proxy, port: 4173, strictPort: true, host: 'localhost' },
})
