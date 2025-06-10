export interface PortalOptions {
	selector?: string;
}

export function portal(node: HTMLElement, options?: PortalOptions) {
	const { selector } = options || {};

	let portalParent;
	if (selector) {
		const query = document.querySelector(selector);
		if (query) portalParent = query;
		else throw new Error(`No existing node that matches selector "${selector}"`);
	} else {
		portalParent = document.body;
	}

	const backdrop = document.createElement('div');

	backdrop.append(node);
	portalParent.append(backdrop);

	return {
		destroy() {
			backdrop.remove();
		}
	};
}
