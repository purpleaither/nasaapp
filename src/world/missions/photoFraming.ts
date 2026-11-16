// Validação geométrica simples, sem reconhecimento de imagem.
import { PHOTO_COMPOSITION, type V3 } from './outcropGeometry.ts';
export const FIELD_PHOTO_FOV = 40;
export const FIELD_PHOTO_ASPECT = 640 / 400;
type Frame = { origin: V3; forward: V3; up: V3 };
const dot = (a: V3, b: V3) => a.reduce((v, x, i) => v + x * b[i], 0);
const sub = (a: V3, b: V3): V3 => a.map((x, i) => x - b[i]) as V3;
const normalized = (v: V3): V3 => { const length = Math.hypot(...v); return v.map(x => x / length) as V3; };
const cross = (a: V3, b: V3): V3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export function validateOutcropPhoto(frame: Frame): { valid: boolean; reason: string } {
  const fail = (reason: string) => ({ valid: false, reason });
  if (![...frame.origin, ...frame.forward, ...frame.up].every(Number.isFinite) || Math.hypot(...frame.forward) < 0.5 || Math.hypot(...frame.up) < 0.5) return fail('Câmera indisponível. Tente novamente.');
  const distance = Math.hypot(...sub(frame.origin, PHOTO_COMPOSITION.focus));
  if (distance < 12 || distance > 38) return fail('Afaste-se ou aproxime-se: mantenha a câmera entre 12 e 38 UJ do bloco.');
  // Observação frontal e diagonal: evita aceitar fotos através da rocha ou por trás.
  const toCamera = normalized(sub(frame.origin, PHOTO_COMPOSITION.fracture));
  if (frame.origin[2] > -3 || dot(toCamera, [0.57, 0, -0.82]) < 0.25) return fail('Contorne o bloco até enxergar o canto ausente pela frente.');
  const forward = normalized(frame.forward), right = normalized(cross(forward, frame.up)), up = normalized(cross(right, forward));
  if (![...right, ...up].every(Number.isFinite)) return fail('Direção da câmera inválida.');
  const tangent = Math.tan(FIELD_PHOTO_FOV * Math.PI / 360);
  for (const p of PHOTO_COMPOSITION.anchors) {
    const d = sub(p, frame.origin), depth = dot(d, forward);
    if (depth <= 0 || Math.abs(dot(d, right)) > depth * tangent * FIELD_PHOTO_ASPECT * 0.9 || Math.abs(dot(d, up)) > depth * tangent * 0.9) {
      return fail('Enquadre a superfície avermelhada e a face fraturada na mesma fotografia.');
    }
  }
  return { valid: true, reason: '' };
}
