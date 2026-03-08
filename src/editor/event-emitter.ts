import type { IEventEmitter, MetaData } from './types';

export interface ProxyOptions<S, T> {
	prefixes?: string | string[];
	events?: (keyof S)[];
	transform?: (
		eventName: keyof S,
		payload: S[keyof S],
		prefix: string,
		source: IEventEmitter<S>
	) => T[keyof T];
}

export class EventEmitter<T> implements IEventEmitter<T> {
	private _events: {
		[K in keyof T]?: Array<{
			fn: (data: T[K], meta?: MetaData) => void;
			once: boolean;
			context: unknown;
		}>;
	} = {};
	private eventSuspended = false;
	private _proxies = new Map<object, () => void>();

	private suspendEvents(): void {
		this.eventSuspended = true;
	}

	private resumeEvents(): void {
		this.eventSuspended = false;
	}

	public withSuspended(fn: () => void): void {
		this.suspendEvents();
		try {
			fn.call(this);
		} finally {
			this.resumeEvents();
		}
	}

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
		if (this.eventSuspended) {
			return false;
		}

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

	public proxy<S>(source: IEventEmitter<S>, options: ProxyOptions<S, T> = {}): void {
		if (this._proxies.has(source)) {
			console.warn('Already proxying this event emitter.');
			return;
		}

		if (!options.events) {
			console.error('Cannot proxy all events');
			return;
		}

		const eventsToProxy = options.events;
		const prefixes = options.prefixes
			? Array.isArray(options.prefixes)
				? options.prefixes
				: [options.prefixes]
			: [''];

		const handlers: { event: keyof S; handler: (payload: S[keyof S]) => void }[] = [];

		for (const eventName of eventsToProxy) {
			const handler = (payload: S[keyof S]) => {
				for (const prefix of prefixes) {
					const finalPayload = options.transform
						? options.transform(eventName, payload, prefix, source)
						: payload;
					this.emit(
						`${prefix}${String(eventName)}` as keyof T,
						finalPayload as unknown as T[keyof T]
					);
				}
			};
			handlers.push({ event: eventName, handler });
			source.on(eventName, handler);
		}

		const unproxy = () => {
			for (const { event, handler } of handlers) {
				source.off(event, handler);
			}
			this._proxies.delete(source);
		};

		this._proxies.set(source, unproxy);
	}

	public unproxy<S>(source: IEventEmitter<S>): void {
		const unproxyFn = this._proxies.get(source);
		if (unproxyFn) {
			unproxyFn();
		}
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
