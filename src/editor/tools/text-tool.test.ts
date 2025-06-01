import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Core } from '@editor/core';
import { App, createAppInstance } from '@editor/app';
import { BusManager } from '@editor/bus-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { BaseBusTools } from '@editor/bus-tools';
import { BaseBusNotification } from '@editor/bus-notification';
import { Camera } from '@editor/camera';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import type { ToolManager } from '@editor/tool-manager';
import type { FontManager } from '@editor/font-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { ILayer } from '@editor/types';
import { TextTool } from './text-tool';

vi.mock('canvaskit-wasm', () => cvk);

const createKeyboardEvent = (
  type: 'keydown' | 'keyup',
  key: string,
  ctrlKey: boolean = false,
  metaKey: boolean = false,
  shiftKey: boolean = false
): KeyboardEvent => {
  return new KeyboardEvent(type, { key, ctrlKey, metaKey, shiftKey, bubbles: true, cancelable: true });
};

const createMouseEvent = (
  type: 'mousedown' | 'mousemove' | 'mouseup',
  clientX: number,
  clientY: number,
  button: number = 0
): MouseEvent => {
  return new MouseEvent(type, { clientX, clientY, button, bubbles: true, cancelable: true });
};

const mockClipboardData = {
  text: '',
};
const mockClipboard = {
  writeText: vi.fn((data: string) => {
    mockClipboardData.text = data;
    return Promise.resolve();
  }),
  readText: vi.fn(() => Promise.resolve(mockClipboardData.text)),
};

describe('TextTool', () => {
  let core: Core;
  let app: App;
  let textTool: TextTool;
  let camera: Camera;
  let busManager: BusManager;
  let toolManager: ToolManager;
  let historyManager: HistoryManager;
  let fontManager: FontManager;
  let activeLayer: ILayer;
  let selectCanvasElement: HTMLCanvasElement;

  const getToolState = (toolInstance: TextTool) => {
    return {
      selectedCell: toolInstance['selectedCell'],
      historyBatchTransaction: toolInstance['historyBatchTransaction'],
    };
  };

  beforeEach(() => {
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(mockClipboard as any);
    mockClipboardData.text = '';

    busManager = new BusManager({
      layers: new BaseBusLayers(),
      tools: new BaseBusTools(),
      notifications: new BaseBusNotification(),
    });

    camera = new Camera(1200, 800);
    const canvasKitInstance = cvk.CanvasKit as any;
    const appFontData = { buffer: new ArrayBuffer(8), family: 'TestAppFont' };

    const gridEl = document.createElement('canvas');
    selectCanvasElement = document.createElement('canvas');
    const asciiEl = document.createElement('canvas');

    const [_core, _app] = createAppInstance({
      canvasKitInstance,
      gridCanvasElement: gridEl,
      selectCanvasElement,
      asciiCanvasElement: asciiEl,
      busManager,
      camera,
      font: appFontData,
    });

    core = _core;
    app = _app;

    toolManager = core.getToolManager();
    historyManager = core.getHistoryManager();
    fontManager = core.getFontManager();

    textTool = new TextTool(core);
    app.registerTool(textTool);
    toolManager.setDefaultTool(textTool);

    activeLayer = core.getLayersManager().ensureLayer();

    vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
      size: 18, dimensions: { width: 10, height: 18 }, lineHeight: 22
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    historyManager.clear();
  });

  const cellToWorld = (cellX: number, cellY: number) => {
    const fontMetrics = core.getFontManager().getMetrics();
    const charWidth = fontMetrics?.dimensions?.width || 10;
    const charHeight = fontMetrics?.dimensions?.height || 18;
    return { x: cellX * charWidth, y: cellY * charHeight };
  };

  const clickAtCell = (cellX: number, cellY: number) => {
    const coords = cellToWorld(cellX, cellY);
    selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', coords.x, coords.y));
  };

  const typeCharacters = (chars: string) => {
    for (const char of chars) {
      document.dispatchEvent(createKeyboardEvent('keydown', char));
    }
  };

  it('should have "text" as its name and be visible', () => {
    expect(textTool.name).toBe('text');
    expect(textTool.isVisible).toBe(true);
  });

  it('should correctly write typed characters to the layer upon committing the session via Escape key', () => {
    clickAtCell(1, 1);
    typeCharacters("ABC");

    document.dispatchEvent(createKeyboardEvent('keydown', 'Escape'));

    expect(activeLayer.getChar(1, 1)).toBe('A');
    expect(activeLayer.getChar(2, 1)).toBe('B');
    expect(activeLayer.getChar(3, 1)).toBe('C');
    expect(getToolState(textTool).selectedCell).toBeNull();
    expect(getToolState(textTool).historyBatchTransaction).toBeNull();
  });

  describe('Commit Triggers', () => {
    const scenarios = [
      {
        triggerName: 'tool deactivation',
        action: () => textTool.deactivate(),
      },
      {
        triggerName: 'layer visibility change (to hidden)',
        action: () => activeLayer.update({ opts: { visible: false } }),
      },
      {
        triggerName: 'active layer change',
        action: () => core.getLayersManager().addLayer(),
      },
      {
        triggerName: 'clicking on a different cell',
        action: () => clickAtCell(10, 10),
      }
    ];

    scenarios.forEach(scenario => {
      it(`should commit current text and end session when ${scenario.triggerName} occurs`, () => {
        clickAtCell(0, 0);
        typeCharacters("T");

        expect(getToolState(textTool).selectedCell).toEqual({ x: 1, y: 0 });
        expect(getToolState(textTool).historyBatchTransaction).not.toBeNull();

        scenario.action();
        expect(activeLayer.getChar(0, 0)).toBe('T');
      });
    });
  });

  describe('Mouse Interaction', () => {
    it('should start an edit session on mouse down, and typed text appears after commit', () => {
      clickAtCell(2, 2);
      typeCharacters("X");
      clickAtCell(10, 10);
      expect(activeLayer.getChar(2, 2)).toBe('X');
    });

    it('should commit previous edit session and start a new one if clicking on a different cell', () => {
      clickAtCell(1, 1);
      typeCharacters("A");

      clickAtCell(3, 3);
      expect(activeLayer.getChar(1, 1)).toBe('A');
      expect(getToolState(textTool).selectedCell).toEqual({ x: 3, y: 3 });

      typeCharacters("B");
      clickAtCell(10, 10);
      expect(activeLayer.getChar(3, 3)).toBe('B');
    });
  });

  describe('Arrow Key Navigation', () => {
    it('should allow typing at new position after arrow key navigation', () => {
      clickAtCell(1, 1);
      typeCharacters("AB");
      document.dispatchEvent(createKeyboardEvent('keydown', 'ArrowDown'));
      typeCharacters("C");

      document.dispatchEvent(createKeyboardEvent('keydown', 'Escape'));

      expect(activeLayer.getChar(1, 1)).toBe('A');
      expect(activeLayer.getChar(2, 1)).toBe('B');
      expect(activeLayer.getChar(3, 2)).toBe('C');
    });
  });

  describe('Backspace Functionality', () => {
    it('should delete character to the left when Backspace is pressed', () => {
      clickAtCell(0, 0);
      typeCharacters("AB");
      document.dispatchEvent(createKeyboardEvent('keydown', 'Backspace'));
      document.dispatchEvent(createKeyboardEvent('keydown', 'Escape'));

      expect(activeLayer.getChar(0, 0)).toBe('A');
      expect(activeLayer.getChar(1, 0)).toBe(' ');
    });

    it('should delete character to the left at negative coordinates', () => {
      clickAtCell(-5, -5);
      typeCharacters("AB");
      document.dispatchEvent(createKeyboardEvent('keydown', 'Backspace'));
      document.dispatchEvent(createKeyboardEvent('keydown', 'Escape'));

      expect(activeLayer.getChar(-5, -5)).toBe('A');
      expect(activeLayer.getChar(-4, -5)).toBe(' ');
      expect(getToolState(textTool).selectedCell).toBeNull();
      expect(getToolState(textTool).historyBatchTransaction).toBeNull();
    });
  });

  it('should correctly write typed characters to the layer at negative coordinates', () => {
    clickAtCell(-5, -5);
    typeCharacters("NEG");

    document.dispatchEvent(createKeyboardEvent('keydown', 'Escape'));

    expect(activeLayer.getChar(-5, -5)).toBe('N');
    expect(activeLayer.getChar(-4, -5)).toBe('E');
    expect(activeLayer.getChar(-3, -5)).toBe('G');
    expect(getToolState(textTool).selectedCell).toBeNull();
    expect(getToolState(textTool).historyBatchTransaction).toBeNull();
  });

  it('should paste text from clipboard onto activeLayer', async () => {
    const pasteText = "Hello\nWorld";
    mockClipboardData.text = pasteText;

    clickAtCell(1, 1);
    document.dispatchEvent(createKeyboardEvent('keydown', 'v', true));
    await new Promise(resolve => setTimeout(resolve, 50));
    document.dispatchEvent(createKeyboardEvent('keydown', 'Escape'));

    expect(activeLayer.getChar(1, 1)).toBe('H');
    expect(activeLayer.getChar(2, 1)).toBe('e');
    expect(activeLayer.getChar(1, 2)).toBe('W');
  });

  it('should correctly undo/redo a committed text edit session', () => {
    clickAtCell(2, 2);
    const initialTextOnLayer = activeLayer.readRegion(2, 2, 4, 1);
    typeCharacters("TEST");
    document.dispatchEvent(createKeyboardEvent('keydown', 'Escape'));

    expect(activeLayer.readRegion(2, 2, 4, 1)).toBe("TEST");

    historyManager.undo();
    expect(activeLayer.readRegion(2, 2, 4, 1)).toBe(initialTextOnLayer);

    historyManager.redo();
    expect(activeLayer.readRegion(2, 2, 4, 1)).toBe("TEST");
  });

  describe('Layer Visibility and Requirements', () => {
    it('should prevent all text tool interactions (typing, mousedown) if the active layer is not visible', () => {
      activeLayer.update({ opts: { visible: false } });
      expect(textTool.checkRequirements()).toBe(false);

      clickAtCell(0, 0);
      typeCharacters("X");
      document.dispatchEvent(createKeyboardEvent('keydown', 'Escape'));

      expect(activeLayer.getChar(0, 0)).toBe(' ');
      expect(getToolState(textTool).selectedCell).toBeNull();
    });

    it('should re-enable interactions when layer becomes visible again', () => {
      activeLayer.update({ opts: { visible: false } });
      expect(textTool.checkRequirements()).toBe(false);

      activeLayer.update({ opts: { visible: true } });
      expect(textTool.checkRequirements()).toBe(true);

      clickAtCell(0, 0);
      typeCharacters("Y");
      document.dispatchEvent(createKeyboardEvent('keydown', 'Escape'));
      expect(activeLayer.getChar(0, 0)).toBe('Y');
    });
  });
});

