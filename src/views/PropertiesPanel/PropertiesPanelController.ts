import { writable, type Writable } from 'svelte/store';
import type { SelectionManager } from '@editor/select/selection-manager';
import type { ISmartObject, SmartObjectAnchor } from '@editor/objects/smart-object.interface';
import type { HistoryManager } from '@editor/history-manager';
import * as objectCmds from '@editor/objects/object-commands';
import {
	StandardGroupKeys,
	TransformProperties,
	FillAndStrokeProperties,
	MetaProperties,
	AppearanceProperties,
	ImageProperties
} from '@editor/objects/properties';
import type {
	FieldDescriptor,
	GroupDescriptor,
	ObjectDescriptor,
	PanelDescriptor,
	PropertySpec
} from './types';

type AllFieldKeys =
	| TransformProperties
	| FillAndStrokeProperties
	| MetaProperties
	| AppearanceProperties
	| ImageProperties;

const GROUP_LABELS: Record<StandardGroupKeys, string> = {
	[StandardGroupKeys.TRANSFORM]:     'Transform',
	[StandardGroupKeys.FILL_AND_STROKE]: 'Fill & Stroke',
	[StandardGroupKeys.META]:          'Meta',
	[StandardGroupKeys.APPEARANCE]:    'Appearance',
	[StandardGroupKeys.IMAGE]:         'Image',
};

const FIELD_LABELS: Partial<Record<AllFieldKeys, string>> = {
	[TransformProperties.X]:                    'X',
	[TransformProperties.Y]:                    'Y',
	[TransformProperties.WIDTH]:                'W',
	[TransformProperties.HEIGHT]:               'H',
	[TransformProperties.ROTATION]:             'Rotation',
	[FillAndStrokeProperties.FILL_COLOR]:       'Fill',
	[FillAndStrokeProperties.STROKE_COLOR]:     'Stroke',
	[FillAndStrokeProperties.STROKE_WIDTH]:     'Stroke Width',
	[MetaProperties.NAME]:                      'Name',
	[AppearanceProperties.BORDER_STYLE]:        'Style',
	[AppearanceProperties.HORIZONTAL]:          '─',
	[AppearanceProperties.VERTICAL]:            '│',
	[AppearanceProperties.TOP_LEFT]:            '┌',
	[AppearanceProperties.TOP_RIGHT]:           '┐',
	[AppearanceProperties.BOTTOM_LEFT]:         '└',
	[AppearanceProperties.BOTTOM_RIGHT]:        '┘',
	[AppearanceProperties.DIAGONAL_DOWN]:       '\\',
	[AppearanceProperties.DIAGONAL_UP]:         '/',
	[AppearanceProperties.ARROW_RIGHT]:         '>',
	[AppearanceProperties.ARROW_LEFT]:          '<',
	[AppearanceProperties.ARROW_DOWN]:          'v',
	[AppearanceProperties.ARROW_UP]:            '^',
	[ImageProperties.MODE]:                     'Mode',
	[ImageProperties.CHARSET]:                  'Charset',
	[ImageProperties.RAMP]:                     'Custom Ramp',
	[ImageProperties.INVERT]:                   'Invert',
	[ImageProperties.CONTRAST]:                 'Contrast',
	[ImageProperties.BRIGHTNESS]:               'Brightness',
	[ImageProperties.THRESHOLD]:                'Threshold',
	[ImageProperties.EDGE_THRESHOLD]:           'Edge Threshold',
};

const GROUP_ORDER: StandardGroupKeys[] = [
	StandardGroupKeys.TRANSFORM,
	StandardGroupKeys.META,
	StandardGroupKeys.APPEARANCE,
	StandardGroupKeys.IMAGE,
	StandardGroupKeys.FILL_AND_STROKE,
];

const EMPTY_DESCRIPTOR: PanelDescriptor = {
	isEmpty: true,
	count: 0,
	primaryObjectType: null,
	primaryObjectName: null,
	commonGroups: [],
	objectDescriptors: []
};

type RawSpec = {
	type: string;
	value: unknown;
	min?: number;
	max?: number;
	step?: number;
	values?: string[];
};

type PathEntry = { spec: PropertySpec; value: unknown };

function extractPaths(obj: ISmartObject): Map<string, PathEntry> {
	const paths = new Map<string, PathEntry>();
	const snap = obj.properties.snapshot() as Record<string, Record<string, unknown> | undefined>;

	const NON_RESIZE_SKIP = new Set<string>(['transform.width', 'transform.height']);

	for (const [groupKey, group] of Object.entries(snap)) {
		if (!group || typeof group !== 'object') continue;

		for (const [fieldKey, raw] of Object.entries(group)) {
			if (!raw || typeof raw !== 'object') continue;

			const path = `${groupKey}.${fieldKey}`;
			if (!obj.capabilities.canResize && NON_RESIZE_SKIP.has(path)) continue;

			const s = raw as RawSpec;
			let spec: PropertySpec;

			if (s.type === 'number') {
				spec = { type: 'number', min: s.min, max: s.max, step: s.step };
			} else if (s.type === 'string') {
				spec = { type: 'string' };
			} else if (s.type === 'boolean') {
				spec = { type: 'boolean' };
			} else if (s.type === 'enum' && Array.isArray(s.values)) {
				spec = { type: 'enum', values: s.values };
			} else {
				continue;
			}

			paths.set(path, { spec, value: s.value });
		}
	}

	return paths;
}

function fullySharedPaths(commonPaths: Set<string>, allPathMaps: Map<string, PathEntry>[]): Set<string> {
	const result = new Set<string>();
	const groupKeys = new Set([...commonPaths].map((p) => p.split('.')[0]));
	for (const groupKey of groupKeys) {
		if (groupKey === StandardGroupKeys.META) continue;
		const count = [...commonPaths].filter((p) => p.split('.')[0] === groupKey).length;
		if (allPathMaps.every((m) => [...m.keys()].filter((k) => k.split('.')[0] === groupKey).length === count)) {
			for (const p of commonPaths) if (p.split('.')[0] === groupKey) result.add(p);
		}
	}
	return result;
}

function intersectSets(sets: Set<string>[]): Set<string> {
	if (sets.length === 0) return new Set();
	const [first, ...rest] = sets;
	const result = new Set<string>();
	for (const key of first) {
		if (rest.every((s) => s.has(key))) result.add(key);
	}
	return result;
}

function buildGroups(
	paths: Set<string>,
	allPathMaps: Map<string, PathEntry>[],
	primaryIdx = 0
): GroupDescriptor[] {
	const byGroup = new Map<string, string[]>();
	for (const path of paths) {
		const groupKey = path.split('.')[0];
		if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
		byGroup.get(groupKey)!.push(path);
	}

	const sortedGroupKeys = [...byGroup.keys()].sort((a, b) => {
		const ai = GROUP_ORDER.indexOf(a as StandardGroupKeys);
		const bi = GROUP_ORDER.indexOf(b as StandardGroupKeys);
		if (ai === -1 && bi === -1) return a.localeCompare(b);
		if (ai === -1) return 1;
		if (bi === -1) return -1;
		return ai - bi;
	});

	return sortedGroupKeys.map((groupKey) => {
		const fieldPaths = byGroup.get(groupKey)!;
		const fields: FieldDescriptor[] = fieldPaths.map((path) => {
			const fieldKey = path.split('.')[1];
			const primary = allPathMaps[primaryIdx].get(path)!;
			const firstValue = primary.value;
			const isMixed =
				allPathMaps.length > 1 && allPathMaps.some((m) => m.get(path)?.value !== firstValue);

			return {
				path,
				groupKey,
				fieldKey,
				label: FIELD_LABELS[fieldKey as AllFieldKeys] ?? fieldKey,
				spec: primary.spec,
				value: firstValue,
				isMixed
			};
		});

		return {
			key: groupKey,
			label: GROUP_LABELS[groupKey as StandardGroupKeys] ?? groupKey,
			fields
		};
	});
}

type SelectionEvents =
	| 'session::changed'
	| 'session::committed'
	| 'session::cancelled'
	| 'manager::session_created'
	| 'manager::session_destroyed';

const SELECTION_EVENTS: SelectionEvents[] = [
	'session::changed',
	'session::committed',
	'session::cancelled',
	'manager::session_created',
	'manager::session_destroyed'
];

export class PropertiesPanelController {
	public readonly descriptor: Writable<PanelDescriptor> = writable(EMPTY_DESCRIPTOR);

	private readonly selectionManager: SelectionManager;
	private readonly history: HistoryManager;
	private readonly unsubscribes: Array<() => void> = [];

	constructor(selectionManager: SelectionManager, history: HistoryManager) {
		this.selectionManager = selectionManager;
		this.history = history;
		this.attachListeners();
		this.refresh();
	}

	public setProperty(path: string, value: unknown, objectIds?: string[]): void {
		const objects = this.getSelectableObjects();
		const targets = objectIds ? objects.filter((o) => objectIds.includes(o.id)) : objects;
		if (targets.length === 0) return;

		const batchId = targets.length > 1 ? objectCmds.beginBatch(this.history) : undefined;
		try {
			for (const obj of targets) {
				const scaledAnchors = this.computeScaledAnchors(obj, path, value);
				if (scaledAnchors) {
					objectCmds.setAnchors(this.history, obj, scaledAnchors, batchId);
				} else {
					objectCmds.setProperty(this.history, obj, path, value, batchId);
				}
			}
			if (batchId) objectCmds.commitBatch(this.history, batchId);
		} catch (e) {
			if (batchId) objectCmds.cancelBatch(this.history, batchId);
			throw e;
		}
	}

	private computeScaledAnchors(
		obj: ISmartObject,
		path: string,
		value: unknown
	): Array<{ x: number; y: number }> | null {
		if (path !== 'transform.width' && path !== 'transform.height') return null;
		if (!obj.getAnchors) return null;
		const absAnchors: SmartObjectAnchor[] = obj.getAnchors();
		const geom = absAnchors.filter((a) => a.type === 'geometric');
		if (geom.length < 2) return null;

		const ox = Math.round(obj.getProperty<number>('transform.x'));
		const oy = Math.round(obj.getProperty<number>('transform.y'));

		if (path === 'transform.width') {
			const oldW = Math.max(1, Math.round(obj.getProperty<number>('transform.width')));
			const newW = Math.max(1, Math.round(value as number));
			if (oldW === newW) return null;
			return absAnchors.map((a) => ({
				x: oldW > 1 ? ox + Math.round(((a.x - ox) / (oldW - 1)) * (newW - 1)) : ox,
				y: a.y
			}));
		} else {
			const oldH = Math.max(1, Math.round(obj.getProperty<number>('transform.height')));
			const newH = Math.max(1, Math.round(value as number));
			if (oldH === newH) return null;
			return absAnchors.map((a) => ({
				x: a.x,
				y: oldH > 1 ? oy + Math.round(((a.y - oy) / (oldH - 1)) * (newH - 1)) : oy
			}));
		}
	}

	public destroy(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes.length = 0;
	}

	private attachListeners(): void {
		for (const event of SELECTION_EVENTS) {
			const handler = () => this.refresh();
			this.selectionManager.on(event, handler, this);
			this.unsubscribes.push(() => this.selectionManager.off(event, handler, this));
		}
	}

	private refresh(): void {
		const objects = this.getSelectableObjects();

		if (objects.length === 0) {
			this.descriptor.set(EMPTY_DESCRIPTOR);
			return;
		}

		this.descriptor.set(this.computeDescriptor(objects));
	}

	private getSelectableObjects(): ISmartObject[] {
		const session = this.selectionManager.getActiveSession();
		if (!session) return [];
		return session.getSelectedObjects().filter((o) => o.capabilities.canSelect);
	}

	private computeDescriptor(objects: ISmartObject[]): PanelDescriptor {
		const allPathMaps = objects.map(extractPaths);
		const commonPaths = intersectSets(allPathMaps.map((m) => new Set(m.keys())));
		const visibleCommonPaths = objects.length > 1 ? fullySharedPaths(commonPaths, allPathMaps) : commonPaths;
		const commonGroups = buildGroups(visibleCommonPaths, allPathMaps);

		const objectDescriptors: ObjectDescriptor[] = objects.length === 1
			? objects.map((obj, i) => ({
				objectId: obj.id,
				objectType: obj.type,
				objectName: String(obj.getProperty('meta.name') ?? obj.type),
				uniqueGroups: buildGroups(
					new Set([...allPathMaps[i].keys()].filter((p) => !commonPaths.has(p))),
					[allPathMaps[i]]
				)
			})).filter((od) => od.uniqueGroups.length > 0)
			: [];

		return {
			isEmpty: commonGroups.length === 0 && objectDescriptors.length === 0,
			count: objects.length,
			primaryObjectType: objects[0].type,
			primaryObjectName: String(objects[0].getProperty('meta.name') ?? objects[0].type),
			commonGroups,
			objectDescriptors
		};
	}
}
