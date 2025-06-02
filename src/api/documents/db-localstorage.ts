export class DBLocalStorage<T> {
	private storageKey: string;

	constructor(storageKey: string) {
		this.storageKey = storageKey;
	}

	save(data: T): void {
		try {
			const serializedData = JSON.stringify(data);
			localStorage.setItem(this.storageKey, serializedData);
		} catch (error) {
			console.error('Failed to save data to localStorage:', error);
		}
	}

	load(): T | null {
		try {
			const serializedData = localStorage.getItem(this.storageKey);
			if (serializedData) {
				return JSON.parse(serializedData) as T;
			}
			console.warn(`No data found in localStorage under key "${this.storageKey}".`);
			return null;
		} catch (error) {
			console.error('Failed to load data from localStorage:', error);
			return null;
		}
	}

	clear(): void {
		try {
			localStorage.removeItem(this.storageKey);
		} catch (error) {
			console.error('Failed to clear data from localStorage:', error);
		}
	}
}
