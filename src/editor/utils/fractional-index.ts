const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = ALPHABET.length;

function codeAt(s: string, i: number): number {
	const ch = s[i];
	const idx = ALPHABET.indexOf(ch);
	if (idx === -1) throw new Error(`Invalid fractional index character: ${ch}`);
	return idx;
}

function longestCommonPrefixTreatingZeros(a: string, b: string): string {
	let i = 0;
	while (true) {
		const aHas = i < a.length;
		const bHas = i < b.length;
		if (!bHas) break;
		const bCh = b[i];
		const aCh = aHas ? a[i] : ALPHABET[0];
		if (aCh !== bCh) break;
		i++;
	}
	return b.slice(0, i);
}

function midpointFraction(a: string, b: string | null): string {
	if (b !== null) {
		const common = longestCommonPrefixTreatingZeros(a, b);
		if (common.length > 0) {
			const aRest = a.slice(common.length);
			const bRest = b.slice(common.length);
			const midRest = midpointFraction(aRest, bRest.length ? bRest : null);
			return common + midRest;
		}
	}

	const aFirst = a.length ? codeAt(a, 0) : 0;
	const bFirst = b === null ? BASE : b.length ? codeAt(b, 0) : 0;

	if (bFirst - aFirst > 1) {
		const mid = Math.floor((aFirst + bFirst) / 2);
		return ALPHABET[mid];
	}

	if (b !== null && b.length > 1) {
		return b[0];
	}

	if (a.length === 0) {
		return ALPHABET[Math.floor(BASE / 2)];
	}
	const firstCh = a[0];
	const rest = a.slice(1);
	return firstCh + midpointFraction(rest, null);
}

export function fractionalIndexBetween(
	prev: string | null | undefined,
	next: string | null | undefined
): string {
	const a = prev ?? '';
	const b = next ?? null;
	let res = midpointFraction(a, b);
	if (a !== '' && (res === a || res < a)) {
		res = a + ALPHABET[Math.floor(BASE / 2)];
	}
	if (b !== null && (res === b || res > b)) {
		const aFirst = a.length ? codeAt(a, 0) : 0;
		const bFirst = codeAt(b, 0);
		if (bFirst - aFirst > 1) {
			const mid = Math.floor((aFirst + bFirst) / 2);
			res = ALPHABET[mid];
		} else {
			const fallback = b[0];
			res =
				fallback > ALPHABET[0]
					? ALPHABET[ALPHABET.indexOf(fallback) - 1] + ALPHABET[Math.floor(BASE / 2)]
					: ALPHABET[0] + ALPHABET[Math.floor(BASE / 2)];
		}
	}
	return res;
}

export function compareFractionalIndex(a: string, b: string): number {
	if (a === b) return 0;
	return a < b ? -1 : 1;
}

export const INTEGER_ZERO = 'a0';
export const SMALLEST_INTEGER = 'A'.padEnd(27, 'A');

function getIntegerLength(head: string): number {
	if (head >= 'a' && head <= 'z') {
		return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
	} else if (head >= 'A' && head <= 'Z') {
		return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
	} else {
		throw new Error('Invalid order key head: ' + head);
	}
}

function validateInteger(int: string): void {
	if (int.length !== getIntegerLength(int.charAt(0))) {
		throw new Error('invalid integer part of order key: ' + int);
	}
}

export function incrementInteger(x: string): string | null {
	validateInteger(x);
	const [head, ...digs] = x.split('');
	let carry = true;
	for (let i = digs.length - 1; carry && i >= 0; i--) {
		const d = ALPHABET.indexOf(digs[i]) + 1;
		if (d === ALPHABET.length) {
			digs[i] = '0';
		} else {
			digs[i] = ALPHABET.charAt(d);
			carry = false;
		}
	}
	if (carry) {
		if (head === 'Z') {
			return 'a0';
		}
		if (head === 'z') {
			return null;
		}
		const h = String.fromCharCode(head.charCodeAt(0) + 1);
		if (h > 'a') {
			digs.push('0');
		} else {
			digs.pop();
		}
		return h + digs.join('');
	} else {
		return head + digs.join('');
	}
}

export function decrementInteger(x: string): string | null {
	validateInteger(x);
	const [head, ...digs] = x.split('');
	let borrow = true;
	for (let i = digs.length - 1; borrow && i >= 0; i--) {
		const d = ALPHABET.indexOf(digs[i]) - 1;
		if (d === -1) {
			digs[i] = ALPHABET.slice(-1);
		} else {
			digs[i] = ALPHABET.charAt(d);
			borrow = false;
		}
	}
	if (borrow) {
		if (head === 'a') {
			return 'Z' + ALPHABET.slice(-1);
		}
		if (head === 'A') {
			return null;
		}
		const h = String.fromCharCode(head.charCodeAt(0) - 1);
		if (h < 'Z') {
			digs.push(ALPHABET.slice(-1));
		} else {
			digs.pop();
		}
		return h + digs.join('');
	} else {
		return head + digs.join('');
	}
}

export function getIntegerPart(key: string): string {
	const integerPartLength = getIntegerLength(key.charAt(0));
	if (integerPartLength > key.length) {
		throw new Error('invalid order key: ' + key);
	}
	return key.slice(0, integerPartLength);
}

export function validateOrderKey(key: string): void {
	if (key === SMALLEST_INTEGER) {
		throw new Error('invalid order key: ' + key);
	}
	const i = getIntegerPart(key);
	const f = key.slice(i.length);
	if (f.slice(-1) === '0') {
		throw new Error('invalid order key: ' + key);
	}
}

export function generateKeyBetween(a: string | null, b: string | null): string {
	const safeTry = (fn: () => string): string | null => {
		try {
			return fn();
		} catch {
			return null;
		}
	};
	const conforming = safeTry(() => {
		if (a !== null) validateOrderKey(a);
		if (b !== null) validateOrderKey(b);
		if (a !== null && b !== null && a >= b) {
			throw new Error(a + ' >= ' + b);
		}
		if (a === null && b === null) {
			return INTEGER_ZERO;
		}
		if (a === null) {
			const ib = getIntegerPart(b!);
			const fb = b!.slice(ib.length);
			if (ib === SMALLEST_INTEGER) {
				return ib + midpointFraction('', fb.length ? fb : null);
			}
			const dec = decrementInteger(ib);
			return dec ?? ib;
		}
		if (b === null) {
			const ia = getIntegerPart(a);
			const fa = a.slice(ia.length);
			const inc = incrementInteger(ia);
			if (inc) {
				return inc;
			}
			return ia + midpointFraction(fa, null);
		}
		const ia = getIntegerPart(a);
		const ib = getIntegerPart(b);
		if (ia === ib) {
			const fa = a.slice(ia.length);
			const fb = b.slice(ib.length);
			return ia + midpointFraction(fa, fb.length ? fb : null);
		}
		const inc = incrementInteger(ia)!;
		if (inc < b) {
			return inc;
		}
		const fa = a.slice(ia.length);
		return ia + midpointFraction(fa, null);
	});
	if (conforming !== null) return conforming;
	return midpointFraction(a ?? '', b ?? null);
}

export function findNeighbors(
	sortedKeys: string[],
	targetKey: string
): { lower: string | null; upper: string | null } {
	let lower: string | null = null;
	let upper: string | null = null;
	for (const key of sortedKeys) {
		const cmpLower = compareFractionalIndex(key, targetKey);
		if (cmpLower < 0) {
			lower = key;
		} else if (compareFractionalIndex(targetKey, key) < 0) {
			upper = key;
			break;
		}
	}
	return { lower, upper };
}

export function resolveCollision(
	desiredKey: string,
	existingKeys: string[],
	nextAfterDesired?: string | null
): string {
	const { upper } = findNeighbors(existingKeys, desiredKey);
	let l = desiredKey;
	let u = upper;
	if (nextAfterDesired !== undefined) {
		u = nextAfterDesired ?? null;
	}
	let candidate = generateKeyBetween(l, u);
	let guard = 0;
	while (existingKeys.includes(candidate) && guard < 64) {
		l = candidate;
		candidate = generateKeyBetween(l, u);
		if (candidate === l) {
			candidate = l + ALPHABET[Math.floor(BASE / 2)];
		}
		guard++;
	}
	return candidate;
}

export function generateKeyForIndex(
	index: number | undefined,
	existingIds: string[],
	getKey: (id: string) => string | undefined,
	excludeId?: string
): string {
	const ids = excludeId ? existingIds.filter((id) => id !== excludeId) : existingIds;
	const clampedIndex = Math.max(0, Math.min(index ?? ids.length, ids.length));
	const prevId = ids[clampedIndex - 1];
	const nextId = ids[clampedIndex];
	const prev = prevId ? (getKey(prevId) ?? null) : null;
	const next = nextId ? (getKey(nextId) ?? null) : null;
	return generateKeyBetween(prev, next);
}
