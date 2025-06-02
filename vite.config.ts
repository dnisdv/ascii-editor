import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'happy-dom', // or 'jsdom', 'node'
		coverage: {
			reporter: ['text', 'json', 'html']
		}
	}
});
