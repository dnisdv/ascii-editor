export type EventName = string | symbol;
export type ListenerFunction = (...args: unknown[]) => void;

export type MetaData = Record<string, unknown> & { reason?: string };

export interface IEventEmitter<T extends Record<EventName, unknown> = Record<EventName, unknown>> {
	on<K extends keyof T>(
		event: K,
		fn: (data: T[K], meta?: MetaData) => void,
		context?: unknown
	): this;
	once<K extends keyof T>(
		event: K,
		fn: (data: T[K], meta?: MetaData) => void,
		context?: unknown
	): this;
	off<K extends keyof T>(
		event: K,
		fn?: (data: T[K], meta?: MetaData) => void,
		context?: unknown
	): this;
	emit<K extends keyof T>(event: K, data?: T[K], meta?: MetaData): boolean;
	listenerCount(event: keyof T): number;
	listeners(event: keyof T): Array<(data: T[keyof T], meta?: MetaData) => void>;
}
