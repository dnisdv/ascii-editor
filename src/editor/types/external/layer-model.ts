import type { ISmartObject } from '@editor/objects/smart-object.interface';

export type LayerConfig = {
	visible: boolean;
	locked: boolean;
};

export interface ILayerModel {
	id: string;
	opts: Partial<LayerConfig>;
	name: string;
	index: number;
	objects: ISmartObject[];
	groupId: string | null;
}
