import type { ILayer } from "@/types"

export type ApiResponse<T> = {
	data: T,
	updated?: {
		layers?: Record<string, ILayer>
	},
	created?: Record<string, unknown>,
	deleted?: Record<string, unknown>
}
