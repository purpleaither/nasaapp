import * as pc from 'playcanvas';

export class EngineSystem {
  public readonly app: pc.Application;
  public readonly isHeadless: boolean;
  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.isHeadless =
      typeof navigator !== 'undefined' &&
      (Boolean(navigator.webdriver) || /HeadlessChrome/i.test(navigator.userAgent));

    this.app = new pc.Application(canvas, {
      mouse: new pc.Mouse(canvas),
      touch: new pc.TouchDevice(canvas),
      keyboard: new pc.Keyboard(window),
      graphicsDeviceOptions: {
        antialias: !this.isHeadless,
        powerPreference: 'high-performance',
      },
    });
    this.app.maxDeltaTime = Number.POSITIVE_INFINITY;

    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.graphicsDevice.maxPixelRatio = this.isHeadless
      ? 1
      : Math.min(window.devicePixelRatio || 1, 2);

    this.resizeHandler = () => {
      this.app.resizeCanvas();
    };
    window.addEventListener('resize', this.resizeHandler);
    this.app.start();
  }

  public onUpdate(fn: (dt: number) => void): void {
    this.app.on('update', fn);
  }

  public destroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.app.destroy();
  }
}
