import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-auto';

const config = {
	preprocess: vitePreprocess({ postcss: true }),
	kit: {
		adapter: adapter(),
		alias: {
			'@editor': 'src/editor/*',
			'@lib': 'src/lib/*',
			'@store': 'src/store/*',
			'@views': 'src/views/*',
			'@theme': 'src/theming/*',
			'@components': 'src/components/*',
			'@': 'src/*',
			'@api': 'src/api/*'
		}
	},
	vite: {
		assetsInclude: ['**/*.wasm']
	},
	onwarn: (warning, handler) => {
		if (warning.code.includes('a11y')) return;
		handler(warning);
	}
};

export default config;
