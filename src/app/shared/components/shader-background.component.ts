import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-shader-background',
  standalone: true,
  template: `
    <canvas #canvas class="w-full h-full block absolute inset-0 pointer-events-none"></canvas>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
  `]
})
export class ShaderBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private animationFrameId?: number;
  private resizeObserver?: ResizeObserver;
  private mouseMoveHandler?: (e: MouseEvent) => void;

  constructor(private themeService: ThemeService) {
    // Angular 17 effect to re-render or update uniform when theme changes
    effect(() => {
      this.themeService.theme();
    });
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const gl = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return;

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_is_light;
      varying vec2 v_texCoord;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec2 uv = v_texCoord;
        float n = noise(uv * 3.0 + u_time * 0.1);
        n += 0.5 * noise(uv * 6.0 - u_time * 0.05);
        
        vec3 darkBase = vec3(0.039, 0.039, 0.039);
        vec3 darkAccent = vec3(0.772, 0.627, 0.349);
        vec3 lightBase = vec3(0.968, 0.964, 0.949);
        vec3 lightAccent = vec3(0.612, 0.471, 0.168);
        
        vec3 baseColor = mix(darkBase, lightBase, u_is_light);
        vec3 accentColor = mix(darkAccent, lightAccent, u_is_light);
        
        float line = smoothstep(0.02, 0.0, abs(mod(uv.x * 20.0 + n * 0.2, 1.0) - 0.5));
        line += smoothstep(0.02, 0.0, abs(mod(uv.y * 20.0 + n * 0.2, 1.0) - 0.5));
        
        float lineMixFactor = mix(0.16, 0.12, u_is_light);
        vec3 finalColor = mix(baseColor, accentColor * (u_is_light > 0.5 ? 0.8 : 0.16), line * n * lineMixFactor);
        finalColor += accentColor * (u_is_light > 0.5 ? 0.03 : 0.06) * n;
        
        vec2 m = u_mouse / u_resolution;
        float distToMouse = distance(uv, m);
        float mouseGlow = smoothstep(0.4, 0.0, distToMouse) * (u_is_light > 0.5 ? 0.12 : 0.18);
        vec3 rippleColor = mix(vec3(0.85, 0.72, 0.45), vec3(0.92, 0.85, 0.70), u_is_light);
        finalColor += rippleColor * mouseGlow;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const createShader = (glCtx: WebGLRenderingContext, type: number, source: string) => {
      const shader = glCtx.createShader(type);
      if (!shader) return null;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
        glCtx.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'u_time');
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uIsLight = gl.getUniformLocation(program, 'u_is_light');

    const mouse = { x: 0, y: 0 };
    this.mouseMoveHandler = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = rect.height - (e.clientY - rect.top);
    };

    window.addEventListener('mousemove', this.mouseMoveHandler);

    const syncSize = () => {
      if (!canvas) return;
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    syncSize();
    this.resizeObserver = new ResizeObserver(() => syncSize());
    this.resizeObserver.observe(canvas);

    const render = (time: number) => {
      syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, time * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      if (uIsLight) gl.uniform1f(uIsLight, this.themeService.isDark() ? 0.0 : 1.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  ngOnDestroy(): void {
    if (this.mouseMoveHandler) {
      window.removeEventListener('mousemove', this.mouseMoveHandler);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
