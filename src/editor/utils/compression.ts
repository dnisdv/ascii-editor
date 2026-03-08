import { strToU8, strFromU8, zlibSync, unzlibSync } from 'fflate';
import * as zlib from 'zlib';

function toBase64(u8: Uint8Array): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(u8).toString('base64');
	}
	let binary = '';
	for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
	return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
	if (typeof Buffer !== 'undefined') {
		return new Uint8Array(Buffer.from(b64, 'base64'));
	}
	const binary = atob(b64);
	const len = binary.length;
	const out = new Uint8Array(len);
	for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
	return out;
}

export type CompressionCodec = 'brotli' | 'deflate';

export type CompressOptions = {
	codec?: CompressionCodec;
	level?: number;
};

const nodeBrotliAvailable = typeof process !== 'undefined' && !!process.versions?.node;

export function compressString(
	input: string,
	opts?: CompressOptions
): { data: string; codec: CompressionCodec } {
	const codec: CompressionCodec = opts?.codec ?? 'deflate';
	if (codec === 'brotli' && nodeBrotliAvailable) {
		try {
			const buf = zlib.brotliCompressSync(Buffer.from(input, 'utf-8'));
			return { data: buf.toString('base64'), codec: 'brotli' };
		} catch {
			void 0;
		}
	}
	const u8 = strToU8(input);
	const lvlNum = Math.max(0, Math.min(9, opts?.level ?? 6));
	const lvl = Math.round(lvlNum) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
	const deflated = zlibSync(u8, { level: lvl });
	return { data: toBase64(deflated), codec: 'deflate' };
}

export function decompressString(b64: string, codec?: CompressionCodec): string {
	const tryDeflate = () => strFromU8(unzlibSync(fromBase64(b64)));
	if (!codec || codec === 'deflate') {
		try {
			return tryDeflate();
		} catch {
			void 0;
		}
	}
	if ((!codec || codec === 'brotli') && nodeBrotliAvailable) {
		try {
			const out = zlib.brotliDecompressSync(Buffer.from(b64, 'base64'));
			return out.toString('utf-8');
		} catch {
			void 0;
		}
	}
	return tryDeflate();
}

export function maybeCompressString(
	input: string,
	thresholdBytes = 256
): { compressed: boolean; codec?: CompressionCodec; data: string } {
	const size = input.length;
	if (size < thresholdBytes) {
		return { compressed: false, data: input };
	}
	const { data, codec } = compressString(input, { codec: 'deflate', level: 6 });
	return { compressed: true, codec, data };
}

export function maybeDecompressString(
	data: string,
	compressed?: boolean,
	codec?: CompressionCodec
): string {
	if (!compressed) return data;
	return decompressString(data, codec);
}
