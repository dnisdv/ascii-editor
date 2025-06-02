import type { EventName, IEventEmitter, MetaData } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventEmitter<T extends Record<EventName, any>> implements IEventEmitter<T> {
	private _events: {
		[K in keyof T]?: Array<{
			fn: (data: T[K], meta?: MetaData) => void;
			once: boolean;
			context: unknown;
		}>;
	} = {};

	on<K extends keyof T>(
		event: K,
		fn: (data: T[K], meta?: MetaData) => void,
		context: unknown = this
	): this {
		this._addListener(event, fn, context, false);
		return this;
	}

	once<K extends keyof T>(
		event: K,
		fn: (data: T[K], meta?: MetaData) => void,
		context: unknown = this
	): this {
		this._addListener(event, fn, context, true);
		return this;
	}

	off<K extends keyof T>(
		event: K,
		fn?: (data: T[K], meta?: MetaData) => void,
		context: unknown = this
	): this {
		if (!this._events[event]) return this;

		if (!fn) {
			delete this._events[event];
		} else {
			this._events[event] = this._events[event]?.filter(
				(listener) => listener.fn !== fn || listener.context !== context
			);
		}
		return this;
	}

	emit<K extends keyof T>(event: K, data?: T[K], meta?: MetaData): boolean {
		const listeners = this._events[event];
		if (!listeners) return false;

		for (const listener of [...listeners]) {
			if (meta) {
				listener.fn.call(listener.context, data as T[K], meta);
			} else {
				listener.fn.call(listener.context, data as T[K]);
			}
			if (listener.once) {
				this.off(event, listener.fn, listener.context);
			}
		}

		return true;
	}

	listenerCount(event: keyof T): number {
		const listeners = this._events[event];
		return listeners ? listeners.length : 0;
	}

	listeners<K extends keyof T>(event: K): Array<(data: T[K], meta?: MetaData) => void> {
		const listeners = this._events[event];
		return listeners ? listeners.map((listener) => listener.fn) : [];
	}

	private _addListener<K extends keyof T>(
		event: K,
		fn: (data: T[K], meta?: MetaData) => void,
		context: unknown,
		once: boolean
	): void {
		if (!this._events[event]) {
			this._events[event] = [];
		}
		this._events[event]!.push({ fn, context, once });
	}
}
