import type { CanvasKit, Paint, Surface, Shader, RuntimeEffect } from 'canvaskit-wasm';
import { Canvas } from './canvas';
import type { CoreApi } from '@editor/core.type';
import type { ICamera } from '@editor/types';
import type { ICanvas } from '@editor/types';

export class Grid extends Canvas implements ICanvas {
  private paint: Paint;
  private shader: Shader | undefined;
  private runtimeEffect: RuntimeEffect | undefined;
  private camera: ICamera;

  constructor(canvas: HTMLCanvasElement, canvasKit: CanvasKit, surface: Surface, private coreApi: CoreApi) {
    super(canvas, canvasKit, surface);
    this.camera = coreApi.getCamera();

    this.paint = new canvasKit.Paint();
    this.paint.setAntiAlias(true);
    this.paint.setStyle(this.canvasKit.PaintStyle.Fill);

    this.coreApi.getConfig().on('changed', () => {
      this.render()
    })

    this.createGridShader();
  }

  private createGridShader(): void {
    const skslCode = `
      uniform float2 u_resolution;
      uniform float2 u_offset;
      uniform float u_scale;
      uniform float u_charwidth;
      uniform float u_charheight;
      uniform float u_dotsize;
      uniform half4 u_color;

      half4 main(float2 fragcoord) {
          float2 uv = (fragcoord + u_offset) / u_scale;
          
          float2 gridpos = mod(uv, float2(u_charwidth, u_charheight));
          float2 disttonearestcorner = min(gridpos, float2(u_charwidth, u_charheight) - gridpos);
          
          // Define min and max dot sizes
          float minDotSize = 0.2;  // Minimum dot size in pixels
          float maxDotSize = 1.0;  // Maximum dot size in pixels
          
          // Calculate dot size that decreases as we zoom out, but stays within min/max bounds
          float adjustedDotSize = clamp(u_dotsize * (sqrt(u_scale)), minDotSize, maxDotSize);
          
          float distance = length(disttonearestcorner);
          
          float smoothFactor = 0.1 + (1.0 / (u_scale + 0.1));  

          // Smooth transition for dot edges
          float smoothDot = smoothstep(adjustedDotSize + smoothFactor, adjustedDotSize - smoothFactor, distance);
          
          // Fade out dots when zooming out
          float fadeout = smoothstep(0.2, 0.8, u_scale);
          

          return u_color * u_color.a * smoothDot * fadeout;
      }
    `;

    const effect = this.canvasKit.RuntimeEffect.Make(skslCode);

    if (!effect) {
      throw new Error('Failed to compile shader');
    }

    this.runtimeEffect = effect;

    const uniforms = this.getUniforms();
    const uniformData = new Float32Array(uniforms);

    this.shader = this.runtimeEffect.makeShader(uniformData);
    this.paint.setShader(this.shader);
  }

  private getUniforms(): number[] {
    const { offsetX, offsetY, scale } = this.camera;
    const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics()

    const { grid: backgroundDots } = this.coreApi.getConfig().getTheme();
    const baseDotSize = 1;

    return [
      this.canvas.width,        // u_resolution.x
      this.canvas.height,       // u_resolution.y
      offsetX * scale,          // u_offset.x
      offsetY * scale,          // u_offset.y
      scale,                    // u_scale
      charWidth,                // u_charWidth 
      charHeight,               // u_charHeight 
      baseDotSize,             // u_dotSize 
      backgroundDots[0], backgroundDots[1], backgroundDots[2], backgroundDots[3]       // u_color 
    ];
  }

  render() {
    const uniforms = this.getUniforms();
    const uniformData = new Float32Array(uniforms);

    this.shader = this.runtimeEffect?.makeShader(uniformData);
    this.paint.setShader(this.shader!);

    this.skCanvas.clear(this.canvasKit.TRANSPARENT);
    this.skCanvas.drawPaint(this.paint);
    this.surface.flush();
  }
}
