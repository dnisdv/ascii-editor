import type { SelectionManager } from '../select/selection-manager';
import type { SmartObjectsManager } from '../smart-objects-manager';
import type { LayersManager } from '../layers/layers-manager';
import type { Config } from '../config';
import type { FeedbackManager } from '../feedback-manager';
import type { ISmartObject } from '../objects/smart-object.interface';
import type { SmartObjectSerializableSchemaType } from '../serializer/smart-object.schema';
import {
	maybeCompressString,
	maybeDecompressString,
	type CompressionCodec
} from '../utils/compression';
import type { HistoryManager } from '../history-manager';
import { TextSelectionObject } from '../objects/text-selection-object';
import { nanoid } from 'nanoid';

const CLIPBOARD_VERSION = 1;
const RICH_TAG_PREFIX = '__ASCII_RICH__:';
type CodecTag = 'C' | 'P';

export interface RichClipboardObjectSnapshot {
	id: string;
	type: string;
	properties: SmartObjectSerializableSchemaType['properties'];
	data: SmartObjectSerializableSchemaType['data'];
	offsetX: number;
	offsetY: number;
}

export interface RichClipboardPayload {
	v: number;
	bbox: { cellX: number; cellY: number; width: number; height: number };
	objects: RichClipboardObjectSnapshot[];
}

interface ClipboardManagerDeps {
	selectionManager: SelectionManager;
	smartObjectsManager: SmartObjectsManager;
	layersManager: LayersManager;
	historyManager: HistoryManager;
	config: Config;
	feedbackManager: FeedbackManager;
}

export class ClipboardManager {
	private selectionManager: SelectionManager;
	private smartObjectsManager: SmartObjectsManager;
	private feedback: FeedbackManager;

	private richClipboard: { payload: RichClipboardPayload; raw: string } | null = null;
	private plainClipboard: string | null = null;

	constructor(deps: ClipboardManagerDeps) {
		this.selectionManager = deps.selectionManager;
		this.smartObjectsManager = deps.smartObjectsManager;
		this.feedback = deps.feedbackManager;
	}

	public copy(): void {
		const payload = this.buildRichPayloadFromSelection();
		if (!payload) return this.info('CLIPBOARD_COPY_EMPTY', 'Nothing selected to copy.');

		const json = JSON.stringify(payload);
		this.richClipboard = { payload, raw: json };

		const { compressed, data, codec } = maybeCompressString(json);
		const richOutput = compressed ? `${RICH_TAG_PREFIX}C:${codec}:${data}` : json;

		const plain = this.buildPlainFromSelection();
		this.plainClipboard = plain || null;

		void this.writeMultiFormatClipboard(plain, richOutput);
		this.success('CLIPBOARD_COPY_SUCCESS', 'Copied selection.');
	}

	public cut(): void {
		this.copy();
		this.selectionManager.removeSelection();
	}

	public async paste(cellX: number, cellY: number): Promise<void> {
		const rich = (await this.readSystemClipboardRich()) ?? this.richClipboard?.payload ?? null;

		if (rich?.objects.length) {
			const staged = this.rehydrateSnapshotsForSelection(rich.objects, cellX, cellY);
			if (staged.length > 0) {
				this.selectionManager.selectSmartObjects(staged, { clearRegion: false });
				this.success('CLIPBOARD_PASTE_SUCCESS', 'Pasted rich selection.');
				return;
			}
		}

		const sys = await this.safeReadClipboard();
		const text = (sys && !sys.startsWith(RICH_TAG_PREFIX) ? sys : this.plainClipboard) || '';

		if (!text.trim()) return this.info('CLIPBOARD_PASTE_EMPTY', 'Clipboard is empty.');

		const lines = text.split('\n');
		const width = lines.reduce((m, l) => Math.max(m, l.length), 0);
		const height = lines.length;
		const obj = new TextSelectionObject({ cellX, cellY, width, height }, text);

		this.selectionManager.selectSmartObjects([obj], { clearRegion: false });
		this.success('CLIPBOARD_PASTE_SUCCESS', 'Pasted plain text selection.');
	}

	public writeText(text: string): void {
		this.safeWriteClipboard(text);
	}

	private buildRichPayloadFromSelection(): RichClipboardPayload | null {
		const session = this.selectionManager.getActiveSession();
		if (!session || session.isEmpty()) return null;

		const bbox = session.boundingBox;
		const objects: RichClipboardObjectSnapshot[] = session.getSelectedObjects().map((obj) => {
			const snap = obj.serialize();
			const relX = (obj.getProperty('transform.x') || 0) - bbox.cellX;
			const relY = (obj.getProperty('transform.y') || 0) - bbox.cellY;
			return {
				id: snap.id,
				type: snap.type,
				properties: snap.properties,
				data: snap.data,
				offsetX: relX,
				offsetY: relY
			};
		});

		return { v: CLIPBOARD_VERSION, bbox: { ...bbox }, objects };
	}

	private decodeRich(tagged: string): RichClipboardPayload | null {
		if (!tagged.startsWith(RICH_TAG_PREFIX)) return null;

		const meta = tagged.substring(RICH_TAG_PREFIX.length);
		const mode = meta.slice(0, 2) as `${CodecTag}:`;

		if (mode === 'C:') {
			const parts = meta.split(':');
			if (parts.length < 3) return null;
			const codec = parts[1] as CompressionCodec;
			const dataB64 = parts.slice(2).join(':');
			const json = maybeDecompressString(dataB64, true, codec);
			return JSON.parse(json) as RichClipboardPayload;
		}

		if (mode === 'P:') {
			const json = meta.substring(2);
			return JSON.parse(json) as RichClipboardPayload;
		}

		return null;
	}

	private async readSystemClipboardRich(): Promise<RichClipboardPayload | null> {
		const viaItems = await this.readRichFromClipboardItems();
		if (viaItems) return viaItems;

		const text = await this.safeReadClipboard();
		if (!text) return null;
		return this.decodeRich(text);
	}

	private buildPlainFromSelection(): string {
		const session = this.selectionManager.getActiveSession();
		if (!session || session.isEmpty()) return '';

		const { width, height, cellX, cellY } = session.boundingBox;
		if (width < 1 || height < 1) return '';

		const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));

		for (const obj of session.getSelectedObjects()) {
			const ascii = this.hasCustomToString(obj)
				? obj.toString() || ''
				: (obj as { selectedText?: string }).selectedText || '';

			if (!ascii) continue;

			const lines = ascii.split('\n');
			const ox = (obj.getProperty('transform.x') || 0) - cellX;
			const oy = (obj.getProperty('transform.y') || 0) - cellY;

			for (let ly = 0; ly < lines.length; ly++) {
				const gy = oy + ly;
				if (gy < 0 || gy >= height) continue;

				const line = lines[ly];
				for (let lx = 0; lx < line.length; lx++) {
					const gx = ox + lx;
					if (gx < 0 || gx >= width) continue;

					const ch = line[lx];
					if (ch !== ' ' && ch !== '\n') {
						grid[gy][gx] = ch;
					}
				}
			}
		}

		return grid.map((row) => row.join('')).join('\n');
	}

	private hasCustomToString(o: unknown): o is { toString: () => string } {
		if (!o || typeof o !== 'object') return false;
		const obj = o as { toString?: unknown };
		return typeof obj.toString === 'function' && obj.toString !== Object.prototype.toString;
	}

	private async writeMultiFormatClipboard(plain: string, richJson: string): Promise<void> {
		if (
			typeof navigator.clipboard?.write === 'function' &&
			typeof window.ClipboardItem === 'function'
		) {
			try {
				const item = new window.ClipboardItem({
					'text/plain': new Blob([plain ?? ''], { type: 'text/plain' }),
					'application/x-ascii-editor': new Blob([richJson], { type: 'application/x-ascii-editor' })
				});
				await navigator.clipboard.write([item]);
				return;
			} catch {
				void 0;
			}
		}

		if (plain) this.safeWriteClipboard(plain);
	}

	private async readRichFromClipboardItems(): Promise<RichClipboardPayload | null> {
		if (typeof navigator.clipboard?.read !== 'function') return null;

		try {
			const items = await navigator.clipboard.read();
			for (const item of items) {
				const types = item.types || [];
				const richType = types.find(
					(t) => t === 'application/x-ascii-editor' || t === 'text/x-ascii-editor'
				);

				if (!richType) continue;

				const blob = await item.getType(richType);
				const text = await blob.text();

				try {
					const data = JSON.parse(text) as RichClipboardPayload;
					if (data && typeof data.v === 'number' && Array.isArray(data.objects)) return data;
				} catch {
					const decoded = this.decodeRich(text);
					if (decoded) return decoded;
				}
			}
		} catch {
			void 0;
		}
		return null;
	}

	private async safeReadClipboard(): Promise<string | null> {
		try {
			return await navigator.clipboard.readText();
		} catch {
			return null;
		}
	}

	private safeWriteClipboard(text: string): void {
		try {
			void navigator.clipboard.writeText(text);
		} catch {
			/* ignore */
		}
	}

	private info(code: string, message: string): void {
		this.feedback.report({ code, message, type: 'info' });
	}
	private success(code: string, message: string): void {
		this.feedback.report({ code, message, type: 'success' });
	}

	private rehydrateSnapshotsForSelection(
		snapshots: RichClipboardObjectSnapshot[],
		dropCellX: number,
		dropCellY: number
	): ISmartObject[] {
		return snapshots.reduce<ISmartObject[]>((acc, snap) => {
			try {
				const full = this.snapshotToSerializable(snap, dropCellX, dropCellY);
				const obj = this.smartObjectsManager.createObject(full.type, full);
				if (obj) acc.push(obj);
			} catch (e) {
				console.warn('Clipboard rehydrate failed:', e);
			}
			return acc;
		}, []);
	}

	private snapshotToSerializable(
		snap: RichClipboardObjectSnapshot,
		dropCellX: number,
		dropCellY: number
	): SmartObjectSerializableSchemaType {
		const properties = JSON.parse(JSON.stringify(snap.properties));
		const data = { ...(JSON.parse(JSON.stringify(snap.data)) || {}), __fromPaste: true };

		const newX = dropCellX + snap.offsetX;
		const newY = dropCellY + snap.offsetY;

		if (properties.transform?.x) properties.transform.x.value = newX;
		if (properties.transform?.y) properties.transform.y.value = newY;

		return { id: this.generateId(), type: snap.type, properties, data };
	}

	private generateId(): string {
		return nanoid();
	}
}
