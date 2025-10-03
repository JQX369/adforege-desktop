import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['**/__tests__/**/*.{ts,tsx}', '**/?(*.)+(spec|test).{ts,tsx}'],
		coverage: {
			provider: 'v8',
			reportsDirectory: './coverage',
		},
	},
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
