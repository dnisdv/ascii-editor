import type { ImageSource } from './image-to-ascii';

/**
 * Longest side the decoded bitmap is downscaled to before sampling. Keeps both
 * the sampling loop and the serialized document small.
 */
export const MAX_SOURCE_SIZE = 1024;

export type DecodedImage = {
	source: ImageSource;
	dataUrl: string;
};

function loadImageElement(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = 'Anonymous';
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Failed to decode image'));
		image.src = src;
	});
}

function readFileAsDataUrl(file: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsDataURL(file);
	});
}

function drawToCanvas(image: HTMLImageElement): HTMLCanvasElement {
	const scale = Math.min(1, MAX_SOURCE_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
	const width = Math.max(1, Math.round(image.naturalWidth * scale));
	const height = Math.max(1, Math.round(image.naturalHeight * scale));

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('Canvas 2d context unavailable');
	ctx.drawImage(image, 0, 0, width, height);
	return canvas;
}

function toImageSource(canvas: HTMLCanvasElement): ImageSource {
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('Canvas 2d context unavailable');
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	return { width: imageData.width, height: imageData.height, data: imageData.data };
}

/** Decodes a picked file, downscaling it and re-encoding it for storage. */
export async function decodeImageFile(file: Blob): Promise<DecodedImage> {
	const originalUrl = await readFileAsDataUrl(file);
	const image = await loadImageElement(originalUrl);
	const canvas = drawToCanvas(image);

	let dataUrl = canvas.toDataURL('image/webp', 0.85);
	if (!dataUrl.startsWith('data:image/webp')) {
		dataUrl = canvas.toDataURL('image/png');
	}

	return { source: toImageSource(canvas), dataUrl };
}

/** Rebuilds the sampling source from a serialized data URL. */
export async function decodeDataUrl(dataUrl: string): Promise<ImageSource> {
	const image = await loadImageElement(dataUrl);
	return toImageSource(drawToCanvas(image));
}
