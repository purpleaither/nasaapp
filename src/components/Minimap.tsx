import { localize, useLanguage } from "../i18n/index.ts";
import { useEffect, useState } from 'react';
import { type ExtractionZone, type PoseUpdatedPayload, type VolcanicStatus, WalkerEvent } from '../systems/events/worldEvents.ts';
import { MISSION_CONFIG } from '../systems/missionConfig.ts';
import type { WorldManager } from '../world/WorldManager.ts';
const SIZE = 160, CENTER = 80, SCALE = 0.2;
interface MinimapProps { world: WorldManager; target: ExtractionZone; targetLabel: string; showTarget: boolean; targetDistance: number; geology: VolcanicStatus['geology'] }
export function Minimap({ world, target, targetLabel, showTarget, targetDistance, geology: g }: MinimapProps) {
  useLanguage();
  const [walker, setWalker] = useState<PoseUpdatedPayload>({ ...MISSION_CONFIG.walkerSpawn, y: 0 });
  useEffect(() => {
    let pose: PoseUpdatedPayload = { ...MISSION_CONFIG.walkerSpawn, y: 0 };
    const onPose = (p: PoseUpdatedPayload) => { pose = p; };
    world.on(WalkerEvent.POSE_UPDATED, onPose);
    const timer = setInterval(() => setWalker(old => old.x === pose.x && old.z === pose.z && old.headingDeg === pose.headingDeg ? old : pose), 100);
    return () => { clearInterval(timer); world.off(WalkerEvent.POSE_UPDATED, onPose); };
  }, [world]);
  const map = (p: { x: number; z: number }) => [CENTER + (p.x - walker.x) * SCALE, CENTER - (p.z - walker.z) * SCALE];
  const marker = (p: { x: number; z: number }) => {
    const [x, y] = map(p); const d = Math.max(1, Math.abs(x - CENTER) / 68, Math.abs(y - CENTER) / 68);
    return [CENTER + (x - CENTER) / d, CENTER + (y - CENTER) / d];
  };
  const [tx, ty] = marker(target), [nx, ny] = marker(g.navigation), [rx, ry] = marker(g.refuge);
  return <section aria-label={localize("Minimapa")} className="hud-panel w-[min(38vw,26dvh,11rem)] shrink-0 rounded-xl p-2 font-mono-tech text-orange-100">
    <div className="mb-1 flex justify-between text-xs"><h2>{localize("Rotas do setor")}</h2><span className="text-teal-200">{localize(targetDistance)}{localize(" UJ")}</span></div>
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full rounded border border-slate-400/40 bg-[#20292c]" role="img" aria-label={localize("Mapa centrado no Walker: rotas, bloqueios, abrigo e objetivo; balizas fora da área são projetadas na borda.")}>
      <defs><pattern id="sector-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#cbd5e1" strokeOpacity="0.15" /></pattern></defs>
      <rect width={SIZE} height={SIZE} fill="url(#sector-grid)" />
      {localize(g.routes.map(route => <g key={route.id}><polyline points={route.points.map(p => map(p).join(',')).join(' ')} stroke={route.state === 'open' ? route.id === g.selectedRoute ? '#5eead4' : '#94a3b8' : '#e7b46a'} strokeWidth={route.id === g.selectedRoute ? 2 : 1} strokeDasharray={route.state === 'open' ? '5 3' : '2 2'} fill="none" />{localize(route.state !== 'open' && (() => { const [x, y] = map(route.points[1]); return <g transform={`translate(${x} ${y})`}><path d="M-6 -6L6 6M6 -6L-6 6" stroke="#f7c67c" strokeWidth="3" /></g>; })())}</g>))}
      <g transform={`translate(${rx} ${ry})`}><rect x="-4" y="-4" width="8" height="8" fill="#d8e1e5" /><text y="-7" fill="#d8e1e5" textAnchor="middle" fontSize="7">{localize("BASE")}</text></g>
      {localize(showTarget && <><circle cx={nx} cy={ny} r="5" stroke="#e7b46a" fill="none" strokeWidth="1.5" /><path d={`M${tx} ${ty - 6}l6 6l-6 6l-6 -6Z`} fill="#5eead4" /></>)}
      <g transform={`translate(${CENTER} ${CENTER}) rotate(${walker.headingDeg})`}><path d="M0 -9L6 7L0 4L-6 7Z" fill="#fff7ec" stroke="#111b20" /></g>
    </svg>
    <p className="mt-1 text-[10px] text-teal-200">{localize("◆ ")}{localize(targetLabel)}</p><p className="text-[10px] text-amber-100">{localize("○ ")}{localize(g.navigationLabel)}{localize(" · × bloqueio")}</p>
  </section>;
}
