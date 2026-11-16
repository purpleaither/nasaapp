// ASTRONAUTA: carrega o modelo 3D, a textura e os materiais do personagem.
import * as pc from 'playcanvas';
import { ASTRONAUT_CONFIG } from './config.ts';
import { EvaCamera } from './equipment/EvaCamera.ts';
import { PlayerAnimator, type PlayerAnimation } from './PlayerAnimator.ts';

/** Model, texture and animation integration adapted from oh-mars Player. */
export class AstronautModel {
  private readonly evaCamera: EvaCamera;
  private readonly animator = new PlayerAnimator();
  private readonly modelAsset: pc.Asset;
  private readonly textureAsset: pc.Asset;
  private readonly material = new pc.StandardMaterial();
  private model: pc.Entity | null = null;
  private destroyed = false;
  private active = false;
  private playbackRate = 1;
  private state: PlayerAnimation = 'Idle';

  constructor(
    private readonly app: pc.Application,
    private readonly parent: pc.Entity,
    private readonly fallback: pc.Entity,
    private readonly castShadows: boolean,
  ) {
    // #region ASTRONAUTA — aparência branca do traje (config.ts)
    const brightness = ASTRONAUT_CONFIG.suitBrightness;
    this.material.diffuse = new pc.Color(brightness, brightness, brightness);
    this.material.gloss = 0.35;
    this.material.metalness = ASTRONAUT_CONFIG.suitMetalness;
    this.material.useMetalness = true;
    this.material.update();
    // #endregion
    this.evaCamera = new EvaCamera(app, parent);
    this.modelAsset = new pc.Asset('ExplorerModel', 'container', { url: '/models/astronaut/astronaut.glb' });
    this.textureAsset = new pc.Asset('ExplorerTexture', 'texture', { url: '/models/astronaut/Astronaut_BaseColor.png' });
    this.modelAsset.ready(this.onModelReady, this);
    this.textureAsset.ready(this.onTextureReady, this);
    this.app.assets.add(this.modelAsset);
    this.app.assets.add(this.textureAsset);
    this.app.assets.load(this.modelAsset);
    this.app.assets.load(this.textureAsset);
  }

  private onTextureReady(): void {
    if (this.destroyed) return;
    this.material.diffuseMap = this.textureAsset.resource as pc.Texture;
    this.material.update();
  }

  private onModelReady(): void {
    if (this.destroyed) return;
    const resource = this.modelAsset.resource as pc.ContainerResource;
    const entity = resource.instantiateModelEntity();
    if (!entity) return;
    this.model = entity;
    entity.name = 'OhMarsAstronaut';
    // #region ASTRONAUTA — tamanho e alinhamento dos pés (config.ts)
    const scale = ASTRONAUT_CONFIG.modelScale;
    entity.setLocalScale(scale, scale, scale);
    entity.setLocalPosition(0, ASTRONAUT_CONFIG.modelGroundOffset, 0);
    // #endregion
    entity.forEach((node) => {
      if (!(node instanceof pc.Entity)) return;
      for (const component of [node.model, node.render]) {
        if (!component) continue;
        component.castShadows = this.castShadows;
        component.receiveShadows = this.castShadows;
        for (const mesh of component.meshInstances ?? []) mesh.material = this.material;
      }
    });
    this.animator.initModelAnimations(entity, resource);
    this.parent.addChild(entity);
    this.evaCamera.bindToModel(entity);
    this.fallback.enabled = false;
    this.animator.playAnimation(this.state);
    this.animator.setPlaybackRate(this.playbackRate);
    this.animator.setEnabled(this.active);
  }

  public update(state: PlayerAnimation, active: boolean, playbackRate = 1): void {
    this.state = state;
    this.playbackRate = state === 'Walk' || state === 'Run' ? playbackRate : 1;
    this.animator.setPlaybackRate(this.playbackRate);
    this.active = active;
    this.animator.setEnabled(active);
    if (active) this.animator.playAnimation(state);
  }

  public destroy(): void {
    this.destroyed = true;
    this.modelAsset.off('load', this.onModelReady, this);
    this.textureAsset.off('load', this.onTextureReady, this);
    this.evaCamera.destroy();
    this.animator.dispose();
    this.model?.destroy();
    this.model = null;
    for (const asset of [this.modelAsset, this.textureAsset]) {
      asset.unload();
      this.app.assets.remove(asset);
    }
    this.material.destroy();
  }
}
