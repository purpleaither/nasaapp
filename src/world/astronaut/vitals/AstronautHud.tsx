import { localize, useLanguage } from "../../../i18n/index.ts";
// ASTRONAUTA — painel completo adaptado de oh-mars/src/ui/hud.tsx.
import { useEffect, useState, type CSSProperties } from 'react';
import { BASE_RESTART_DELAY, scheduleAstronautRestart } from '../../../systems/missionRestart.ts';
import type { WorldManager } from '../../WorldManager.ts';
import type { VolcanicStatus } from '../../../systems/events/worldEvents.ts';
import { LIFE_SUPPORT_CONFIG } from './config.ts';
import { LifeSupportEvent } from './events.ts';
import type { VitalsData } from './types.ts';
import './hud.css';

export function AstronautHud({ world, isBoarded, sheltered = false, status, onRetry }: {
  world: WorldManager;
  isBoarded: boolean;
  sheltered?: boolean;
  status: VolcanicStatus | null;
  onRetry: () => void;
}) {
  useLanguage();
  const [restartSeconds, setRestartSeconds] = useState(BASE_RESTART_DELAY / 1000);
  const [vitals, setVitals] = useState<VitalsData>(() => world.getAstronautVitals());
  useEffect(() => {
    world.on(LifeSupportEvent.VITALS_CHANGED, setVitals);
    world.fire(LifeSupportEvent.REQUEST_VITALS);
    return () => world.off(LifeSupportEvent.VITALS_CHANGED, setVitals);
  }, [world]);
  useEffect(() => {
    if (!vitals.isGameOver || status?.phase === 'ended') return;
    setRestartSeconds(BASE_RESTART_DELAY / 1000);
    const cancelRestart = scheduleAstronautRestart(true, onRetry);
    const countdown = setInterval(() => setRestartSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); onRetry(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); cancelRestart(); clearInterval(countdown); };
  }, [vitals.isGameOver, status?.phase, onRetry]);
  if (!status || status.phase === 'ended') return null;

  const rows = [
    { label: 'Vida', emoji: '❤️', value: vitals.health },
    { label: 'Oxigênio', emoji: '💨', value: vitals.oxygen },
    { label: 'Água', emoji: '💧', value: vitals.water },
    { label: 'Comida', emoji: '🍖', value: vitals.food },
  ];
  const factor = vitals.isSuffocating ? (100 - vitals.health) / 100 : 0;
  const visionStyle = {
    '--suffocation-min-opacity': 0.15 + factor * 0.7,
    '--suffocation-max-opacity': 0.55 + factor * 0.45,
    '--suffocation-blur': `${4 + factor * 14}px`,
  } as CSSProperties;
  const deadCause = { asphyxiation: 'Falta de oxigênio', dehydration: 'Desidratação', starvation: 'Fome', rockfall: 'Impacto de rochas' };

  return (
    <div className="astronaut-hud">
      {localize(vitals.isSuffocating && !vitals.isGameOver && (
        <div aria-hidden="true" className="astronaut-suffocation" style={visionStyle} />
      ))}
      <section className="astronaut-vitals" aria-label={localize("Informações do astronauta")}>
        <div className="astronaut-vitals-heading">
          <h2>{localize("Astronauta")}</h2><span>{localize(sheltered ? 'No abrigo' : isBoarded ? 'Na cabine' : 'A pé')}</span>
        </div>
        {localize(rows.map(({ label, emoji, value }) => (
          <div key={label} className={`vital-row ${value < LIFE_SUPPORT_CONFIG.criticalOxygenThreshold ? 'low-warning' : ''}`} title={localize(label)}>
            <span className="vital-emoji" aria-hidden="true">{localize(emoji)}</span>
            <div className="vital-track" role="progressbar" aria-label={localize(label)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
              <div className="vital-fill" style={{ width: `${value}%` }} />
            </div>
            <span className="vital-pct">{localize(Math.round(value))}{localize("%")}</span>
          </div>
        )))}
        <p className="astronaut-vital-state" role="status">
          {localize(vitals.isGameOver ? 'Sinais vitais interrompidos' : vitals.isSuffocating ? 'Sem oxigênio!' : vitals.deathCause === 'rockfall' ? 'Ferimento por queda de rochas' : vitals.isCriticalOxygen ? 'Oxigênio crítico' : vitals.isRecovering ? 'Recuperando vida' : sheltered ? 'Ambiente pressurizado' : isBoarded ? 'Suprimentos preservados' : 'Suporte de vida ativo')}
        </p>
        {localize(!vitals.isGameOver && <div className="astronaut-supply-actions">
          <button disabled={status.phase !== 'operation'} title={localize("O: reabastecer oxigênio")} onClick={() => world.fire(LifeSupportEvent.REFILL_OXYGEN)}>{localize("O · O₂")}</button>
          <button disabled={status.phase !== 'operation'} title={localize("H: beber água")} onClick={() => world.fire(LifeSupportEvent.DRINK_WATER)}>{localize("H · Água")}</button>
          <button disabled={status.phase !== 'operation'} title={localize("J: comer")} onClick={() => world.fire(LifeSupportEvent.EAT_FOOD)}>{localize("J · Comida")}</button>
        </div>)}
      </section>
      {localize(vitals.isGameOver && <div className="astronaut-death-screen" role="dialog" aria-modal="true" aria-labelledby="astronaut-death-title">
        <h2 id="astronaut-death-title">{localize("Você morreu")}</h2>
        <p>{localize(vitals.deathCause ? deadCause[vitals.deathCause] : 'Sinais vitais interrompidos')}</p>
        <p role="status">{localize("Reiniciando missão em ")}{localize(restartSeconds)}{localize("s…")}</p>
        <button autoFocus onClick={onRetry}>{localize("[R] Reiniciar agora")}</button>
      </div>)}
    </div>
  );
}
