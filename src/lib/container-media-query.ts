import type { Writable } from 'svelte/store';
import { dequal } from 'dequal';

interface ContainerQueryOptions {
	breakpoints: Record<string, number>;
	store: Writable<Record<string, boolean>>;
}

export function containerQuery(node: HTMLElement, options: ContainerQueryOptions) {
	let currentMatches: Record<string, boolean> = {};

	const checkAndUpdate = (width: number) => {
		const newMatches: Record<string, boolean> = {};

		for (const key in options.breakpoints) {
			newMatches[key] = width <= options.breakpoints[key];
		}

		if (!dequal(currentMatches, newMatches)) {
			currentMatches = newMatches;
			window.requestAnimationFrame(() => {
				options.store.set(currentMatches);
			});
		}
	};

	const observer = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (entry) {
			checkAndUpdate(entry.contentRect.width);
		}
	});

	checkAndUpdate(node.clientWidth);
	observer.observe(node);

	return {
		update(newOptions: ContainerQueryOptions) {
			options = newOptions;
			checkAndUpdate(node.clientWidth);
		},
		destroy() {
			observer.disconnect();
		}
	};
}
