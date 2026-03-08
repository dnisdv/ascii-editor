export function createDynamicProxy<T extends object>(getCurrent: () => T): T {
	const dummyTarget = {} as T;
	return new Proxy(dummyTarget, {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		get(_: T, prop: PropertyKey, receiver: any): any {
			const current = getCurrent();
			const value = Reflect.get(current, prop, receiver);
			if (typeof value === 'function') {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return (...args: any[]) => Reflect.apply(value, getCurrent(), args);
			}
			return value;
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		set(_: T, prop: PropertyKey, newValue: any, receiver: any): boolean {
			const current = getCurrent();
			return Reflect.set(current, prop, newValue, receiver);
		}
	});
}
