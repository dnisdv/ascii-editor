export interface ILayerGroup {
	id: string;
	name: string;
	collapsed: boolean;
	parentId: string | null;
	index: number;
	opts: LayerGroupConfig;
}

export type LayerGroupConfig = {
	visible: boolean;
	locked: boolean;
};

export const defaultLayerGroupConfig: LayerGroupConfig = {
	visible: true,
	locked: false
};
