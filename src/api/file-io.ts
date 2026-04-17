import { DocumentSchema, type DocumentSchemaType } from '@editor/serializer';

export async function compressProject(data: DocumentSchemaType): Promise<Blob> {
	const json = JSON.stringify(data);
	const blob = new Blob([json]);
	const compressed = blob.stream().pipeThrough(new CompressionStream('gzip'));
	return new Response(compressed).blob();
}

export async function decompressProject(file: Blob): Promise<DocumentSchemaType> {
	const decompressed = file.stream().pipeThrough(new DecompressionStream('gzip'));
	const text = await new Response(decompressed).text();
	const json = JSON.parse(text);
	const result = DocumentSchema.safeParse(json);
	if (!result.success) {
		throw new Error('Invalid .dnascii file');
	}
	return result.data;
}

export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export function pickFile(accept: string): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.click();
	});
}
