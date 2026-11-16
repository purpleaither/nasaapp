import { SignalObjectives } from './SignalObjectives.tsx';
import { localize, useLanguage } from "../i18n/index.ts";
import { HabitatPanel } from './HabitatPanel.tsx';
import type { HabitatStatus } from '../world/habitat/events.ts';
import { GeologicalEvent } from '../world/geological/crisis.ts';
import { GeologicalPanel } from './GeologicalPanel.tsx';
import { CircleAlert, Gamepad2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { PlayerBoardingStatePayload, VolcanicStatus } from '../systems/events/worldEvents.ts';
import { MISSION_CONFIG } from '../systems/missionConfig.ts';
import { MissionOnePanel } from './MissionOnePanel.tsx';
import type { WorldManager } from '../world/WorldManager.ts';
import { MissionResult } from './MissionResult.tsx';

interface HudOverlayProps {
  habitat?: HabitatStatus | null;
  world: WorldManager | null;
  baseMode: boolean;
  boarding: PlayerBoardingStatePayload;
  volcanicStatus: VolcanicStatus | null;
  onToggleBaseMode: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
}

const zones = {
  safe: { Icon: ShieldCheck, label: 'Operacional', color: 'text-emerald-200' },
  heated: { Icon: TriangleAlert, label: 'Integridade comprometida', color: 'text-orange-300' },
  destruction: {
    Icon: CircleAlert,
    label: 'Módulo inoperante',
    color: 'text-red-300',
  },
};
const button =
  'cursor-pointer rounded-md border border-[#72472e] bg-[#2c1a13] px-2.5 py-1.5 font-semibold hover:bg-[#3d2418] aria-pressed:border-[#e6a368] aria-pressed:bg-[#573018]';

export function HudOverlay({
  habitat,
  world,
  baseMode,
  boarding,
  volcanicStatus: status,
  onToggleBaseMode,
  onStart,
  onPause,
  onResume,
  onRetry,
}: HudOverlayProps) {
  useLanguage();
  const [controlsOpen, setControlsOpen] = useState(false);
  if (!status) return null;

  const { Icon: ZoneIcon, label: zoneLabel, color: zoneColor } = zones[status.zone];
  const hullPercent = Math.ceil((100 * status.hull) / MISSION_CONFIG.volcanic.initialHull);

  if (status.phase === 'ended') {
    return (
      <MissionResult
        status={status}
        hullPercent={hullPercent}
        onRetry={onRetry}
      />
    );
  }

  if (habitat?.cycling) return null;
  const insideHabitat = habitat?.location === 'inside';
  const preparing = status.phase === 'preparation';
  const hullAccent =
    hullPercent <= 25
      ? 'bg-red-400'
      : hullPercent <= 55
        ? 'bg-amber-300'
        : 'bg-teal-300';
  const controlsButton = (
    <button
      type="button"
      aria-label={localize("Controles")}
      aria-expanded={controlsOpen}
      aria-controls="hud-controls"
      title={localize("Controles")}
      onClick={() => setControlsOpen((open) => !open)}
      className={`grid shrink-0 cursor-pointer place-items-center border text-orange-200 ${preparing
        ? 'size-9 rounded-lg border-[#72472e] bg-[#2c1a13] hover:bg-[#3d2418] aria-expanded:border-[#e6a368] aria-expanded:bg-[#573018]'
        : 'size-[1.875rem] rounded-md border-[#72472e] bg-[#2c1a13] hover:bg-[#3d2418] aria-expanded:border-[#e6a368] aria-expanded:bg-[#573018]'}`}
    >
      <Gamepad2 size={17} aria-hidden="true" />
    </button>
  );

  const controls = [
    { label: boarding.isBoarded ? 'Dirigir o rover' : 'Caminhar', keys: 'WASD' },
    { label: boarding.isBoarded ? 'Usar turbo' : 'Correr', keys: 'Shift' },
    ...(!boarding.isBoarded ? [{ label: 'Saltar', keys: 'Espaço' }] : []),
    { label: 'Embarcar ou Desembarcar', keys: 'E' },
    { label: 'Repor oxigênio / água / comida', keys: 'O / H / J' },
    { label: 'Executar objetivo científico', keys: 'C' },
    { label: 'Retornar à base, próximo à entrada', keys: 'F' },
    { label: 'Sensores e rotas', keys: 'I' },
    { label: 'Pausar', keys: 'ESC' },
  ];

  return (
    <div
      className={`hud-sidebar pointer-events-none fixed left-4 z-20 w-[21rem] max-w-[calc(100%-2rem)] max-h-[calc(100dvh-18rem)] overflow-y-auto overscroll-contain font-sans text-xs text-[#ffeedf] ${status.phase === 'operation' ? 'top-[4.75rem] lg:top-4' : 'top-4'}`}
    >
      <div className="pointer-events-auto fixed right-3 top-[4.5rem] z-30 lg:right-[14rem] lg:top-[4.5rem]">{controlsButton}</div>
      {/* ASTRONAUTA — aviso de proximidade para entrar/sair do veículo. */}
      {localize(status.phase === 'operation' && !status.fieldActionActive && (boarding.isBoarded || boarding.canBoard) && (
        <div role="status" aria-live="polite" className="mb-2 rounded-lg border border-[#72472e] bg-[#20120e] px-3.5 py-2 text-orange-100">
          {localize(boarding.isBoarded ? 'Pressione E para sair' : 'Pressione E para entrar')}
        </div>
      ))}
      {localize(world && <GeologicalPanel world={world} status={status} />)}
      {localize(world && <MissionOnePanel world={world} status={status} atHabitat={insideHabitat} />)}
      {world && <SignalObjectives world={world} />}
      {localize(world && habitat && insideHabitat && <HabitatPanel world={world} habitat={habitat} status={status} />)}
      
      {localize(!insideHabitat && <section
        aria-label={localize(preparing ? 'Preparação da operação' : 'Estado do rover')}
        className="rounded-xl border border-[#623c27] bg-[#20120e] px-3.5 py-3 shadow-xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#fff3e6]">
            {localize(preparing ? 'Preparação da operação' : 'Estado do rover')}
          </h2>
          <span role="status" className={`inline-flex items-center gap-1.5 text-xs ${zoneColor}`}>
            <ZoneIcon size={14} aria-hidden="true" />
            {localize(zoneLabel)}
          </span>
        </div>
        <dl className="mt-2.5 grid grid-cols-2 gap-2 border-y border-[#533425] py-2">
          <div><dt className="text-xs text-[#ceb2a0]">{localize("Energia disponível")}</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums">{localize(status.geology.energy)}{localize("%")}</dd></div>
          <div><dt className="text-xs text-[#ceb2a0]">{localize("Instrumentos")}</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums">{localize(status.geology.equipment)}{localize("%")}</dd></div>
        </dl>
        <div className="mt-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-3 font-medium">
            <span id="hull-label">{localize("Casco")}</span>
            <span className="font-semibold tabular-nums">{localize(hullPercent)}{localize("%")}</span>
          </div>
          <div
            role="progressbar"
            aria-labelledby="hull-label"
            aria-valuenow={hullPercent}
            className="h-[5px] overflow-hidden rounded-full bg-orange-100/15"
          >
            <div
              className={`h-full rounded-full ${hullAccent}`}
              style={{ width: `${hullPercent}%` }}
            />
          </div>
        </div>

        {localize(status.phase === 'operation' && status.hull < 100 && <div className="pointer-events-auto mt-3 rounded border border-slate-500/50 p-2">
          <button type="button" disabled={!status.geology.repairActive && !status.geology.repairAvailable} onClick={() => world?.fire(GeologicalEvent.REPAIR)} className={`${button} w-full disabled:cursor-not-allowed disabled:opacity-50`}>
            {localize(status.geology.repairActive ? 'Interromper reparo do casco' : 'Reparar casco · consome energia')}
          </button>
          <p role="status" className="mt-1 text-[11px] text-slate-300">{localize(status.geology.repairActive ? 'Recuperando 2,5% de casco/s. Custo: 0,45% de energia por 1% de casco; reserva mínima de 10%.' : status.geology.repairHint)}</p>
        </div>)}
        {localize(status.phase === 'preparation' && !insideHabitat && (
          <div className="pointer-events-auto mt-3">
            <p className="text-xs text-[#ceb2a0]">{localize("Futuro fictício · crise geológica localizada. Investigue os registros sísmicos e monitore as condições operacionais.")}</p>
            <div className="mt-2.5 flex gap-[7px]">
              <button
                type="button"
                onClick={() => {
                  setControlsOpen(false);
                  onStart();
                }}
                className="min-w-0 flex-1 cursor-pointer rounded-lg bg-[#ff9a37] px-3 py-2 font-semibold text-[#291505] hover:bg-[#ffb163]"
              >{localize("Iniciar operação")}</button>
            </div>
          </div>
        ))}

        {localize(status.phase === 'operation' && !insideHabitat && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pointer-events-auto">
            <button
              type="button"
              disabled={status.fieldActionActive}
              onClick={onToggleBaseMode}
              aria-pressed={baseMode}
              className={button}
            >
              {localize(baseMode ? 'Modo manutenção (Ativo)' : 'Rover Tortuga')}
            </button>
            <button type="button" onClick={onPause} className={button}>{localize("Pausar")}</button>
            <span className="ml-auto text-orange-100/75">{localize("Energia · ")}{localize(status.geology.energy)}{localize("%")}</span>
          </div>
        ))}

        {localize(status.phase === 'paused' && !insideHabitat && (
          <div className="mt-3 pointer-events-auto">
            <p className="mb-2 font-bold">{localize("Operação pausada")}</p>
            <button type="button" onClick={onResume} className={button}>{localize("Retomar operação")}</button>
            <button
              type="button"
              onClick={onRetry}
              className={`${button} ml-2`}
            >{localize("Reiniciar teste")}</button>
          </div>
        ))}
      </section>)}
      {localize((preparing || status.phase === 'operation') && (
        <div
          id="hud-controls"
          hidden={!controlsOpen}
          className="pointer-events-auto fixed right-3 top-[7.25rem] z-30 w-[21rem] max-w-[calc(100%-2rem)] rounded-2xl border border-[#623c27] bg-[#20120e] shadow-xl lg:right-[14rem]"
        >
          <dl className="space-y-1.25 px-3.5 py-3 text-orange-100/90 [&_kbd]:bg-orange-400/20 [&_kbd]:rounded-sm [&_kbd]:px-2">
            {localize(controls.map((c) => (
              <div className="flex items-center gap-2" key={c.keys}>
                <dt>
                  <kbd>{localize(c.keys)}</kbd>
                </dt>
                <dd>{localize(c.label)}</dd>
              </div>
            )))}
          </dl>
        </div>
      ))}
    </div>
  );
}
