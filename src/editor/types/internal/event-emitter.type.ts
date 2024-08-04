export type EventName = string | symbol;
export type ListenerFunction = (...args: any[]) => void;

export type MetaData = Record<string, any> & { reason?: string };

export interface IEventEmitter<T extends Record<EventName, any> = Record<EventName, any>> {
  on<K extends keyof T>(event: K, fn: (data: T[K], meta?: MetaData) => void, context?: unknown): this;
  once<K extends keyof T>(event: K, fn: (data: T[K], meta?: MetaData) => void, context?: unknown): this;
  off<K extends keyof T>(event: K, fn?: (data: T[K], meta?: MetaData) => void, context?: unknown): this;
  emit<K extends keyof T>(event: K, data?: T[K], meta?: MetaData): boolean;
  listenerCount(event: keyof T): number;
  listeners(event: keyof T): Array<(data: T[keyof T], meta?: MetaData) => void>;
}

