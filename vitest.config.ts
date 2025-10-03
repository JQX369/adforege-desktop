import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['**/__tests__/**/*.{ts,tsx}', '**/?(*.)+(spec|test).{ts,tsx}'],
		exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
		coverage: {
			provider: 'v8',
			reportsDirectory: './coverage',
			exclude: ['node_modules/', 'dist/', '.next/', '**/*.d.ts', '**/*.config.*'],
		},
		setupFiles: ['./__tests__/setup.ts'],
	},
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
