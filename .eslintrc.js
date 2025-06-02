export default {
	tabWidth: 2,
	useTabs: true,
	printWidth: 80,
	rules: {
		'svelte/valid-compile': ['error', { ignoreWarnings: true }],
		'svelte-a11y/no-static-element-interactions': 'off',
		'svelte-a11y/click-events-have-key-events': 'off'
	}
};
