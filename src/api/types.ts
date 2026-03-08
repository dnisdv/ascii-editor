import type { Layer } from '@editor/layers/layer';

export type ApiResponse<T> = {
	data: T;
	updated?: {
		layers?: Record<string, Layer>;
	};
	created?: Record<string, unknown>;
	deleted?: Record<string, unknown>;
};
