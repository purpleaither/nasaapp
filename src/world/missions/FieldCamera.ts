import { FIELD_PHOTO_FOV } from './photoFraming.ts';
// MISSÕES — fotografia real do render target, identificada por ação e câmera de origem.
import * as pc from 'playcanvas';
import { PlayerEvent, VolcanicEvent } from '../../systems/events/worldEvents.ts';

const WIDTH = 640;
const HEIGHT = 400;
interface CaptureOptions {
  framingValidated?: boolean;
  captureId: number;
  source: 'eva' | 'walker';
  forward?: pc.Vec3;
  up?: pc.Vec3;
}

export class FieldCamera {
  private readonly camera: pc.Entity;
  private readonly target: pc.RenderTarget;
  private readonly texture: pc.Texture;
  private request: { index: number; captureId: number; source: 'eva' | 'walker'; framingValidated: boolean } | null = null;
  private disposed = false;

  constructor(private readonly app: pc.Application) {
    this.texture = new pc.Texture(app.graphicsDevice, { width: WIDTH, height: HEIGHT, format: pc.PIXELFORMAT_RGBA8, mipmaps: false });
    this.target = new pc.RenderTarget({ colorBuffer: this.texture, depth: true });
    this.camera = new pc.Entity('FieldSurveyCamera', app);
    this.camera.enabled = false;
    this.camera.addComponent('camera', {
      renderTarget: this.target, priority: -2, fov: FIELD_PHOTO_FOV, nearClip: 0.2, farClip: 120,
      clearColor: new pc.Color(0.42, 0.24, 0.16),
    });
    app.root.addChild(this.camera);
  }

  public capture(site: pc.Vec3, index: number, eye?: pc.Vec3, options: CaptureOptions = { captureId: 0, source: 'walker' }): void {
    if (this.disposed) return;
    this.app.off('postrender', this.readPhoto, this);
    this.request = { index, captureId: options.captureId, source: options.source, framingValidated: options.framingValidated === true };
    this.camera.setPosition(eye ?? new pc.Vec3(site.x + 11, site.y + 9, site.z + 23));
    // A foto EVA utiliza o eixo óptico da lente presa ao traje, não uma câmera solta no cenário.
    const focus = options.forward ? this.camera.getPosition().clone().add(options.forward.clone().mulScalar(20)) : site;
    this.camera.lookAt(focus, options.up ?? pc.Vec3.UP);
    this.camera.enabled = true;
    if (options.source === 'eva') this.app.fire(PlayerEvent.EVA_CAMERA_SHUTTER);
    this.app.once('postrender', this.readPhoto, this);
  }

  private async readPhoto(): Promise<void> {
    const request = this.request;
    this.request = null;
    this.camera.enabled = false;
    if (!request || this.disposed) return;
    try {
      const pixels = await this.texture.read(0, 0, WIDTH, HEIGHT, { renderTarget: this.target, immediate: true });
      if (this.disposed) return;
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível criar o registro fotográfico.');
      const image = context.createImageData(WIDTH, HEIGHT);
      const stride = WIDTH * 4;
      for (let row = 0; row < HEIGHT; row++) {
        const start = (HEIGHT - 1 - row) * stride;
        image.data.set(pixels.subarray(start, start + stride), row * stride);
      }
      context.putImageData(image, 0, 0);
      this.app.fire(VolcanicEvent.FIELD_PHOTO, { ...request, image: canvas.toDataURL('image/jpeg', 0.9) });
    } catch {
      if (!this.disposed) this.app.fire(VolcanicEvent.FIELD_PHOTO_ERROR, {
        ...request, message: 'Não foi possível salvar a fotografia. Pressione C para tentar novamente.',
      });
    }
  }

  public destroy(): void {
    this.disposed = true;
    this.app.off('postrender', this.readPhoto, this);
    this.camera.destroy();
    this.target.destroy();
    this.texture.destroy();
  }
}
