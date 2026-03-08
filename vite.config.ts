import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: ['f48d49040628.ngrok-free.app', 'good-apes-joke.loca.lt']
	},
	test: {
		environment: 'happy-dom', // or 'jsdom', 'node'
		coverage: {
			reporter: ['text', 'json', 'html']
		}
	}
});
