import type { IEventEmitter } from '@editor/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function proxyEvents<T extends Record<string, any>>(
	source: IEventEmitter<T> & { eventNames: () => (keyof T)[] },
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	target: IEventEmitter<any>,
	prefix: string,
	events?: Array<keyof T>
): () => void {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const handlers: Map<keyof T, (payload: any) => void> = new Map();
	const eventsToProxy = events ?? source.eventNames();

	for (const eventName of eventsToProxy) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const handler = (payload: any) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			target.emit(`${prefix}${String(eventName)}`, { ...payload, layerId: (source as any).id });
		};
		handlers.set(eventName, handler);
		source.on(eventName, handler);
	}

	return () => {
		for (const [eventName, handler] of handlers.entries()) {
			source.off(eventName, handler);
		}
	};
}
