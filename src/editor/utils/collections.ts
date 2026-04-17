export const bucketBy = <T extends { index: number }>(
	items: Iterable<T>,
	key: (item: T) => string | null
): Map<string | null, T[]>  => {
	const map = new Map<string | null, T[]>();
	for (const item of items) {
		const k = key(item);
		if (!map.has(k)) map.set(k, []);
		map.get(k)!.push(item);
	}
	for (const arr of map.values()) arr.sort((a, b) => a.index - b.index);
	return map;
}
