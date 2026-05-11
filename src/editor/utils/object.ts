// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge(base: any, incoming: any): any {
	if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return incoming;
	const result = { ...base };
	for (const key of Object.keys(incoming)) {
		const bv = base?.[key];
		const iv = incoming[key];
		if (bv && iv && typeof bv === 'object' && typeof iv === 'object' && !Array.isArray(iv)) {
			result[key] = deepMerge(bv, iv);
		} else {
			result[key] = iv;
		}
	}
	return result;
}
