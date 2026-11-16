import { localize, useLanguage } from "../i18n/index.ts";
import { useEffect, useState } from 'react';
import { GeologicalEvent, RESCUE_RANGE } from '../world/geological/crisis.ts';
import type { VolcanicStatus } from '../systems/events/worldEvents.ts';
import type { WorldManager } from '../world/WorldManager.ts';
const button = 'cursor-pointer rounded border border-slate-500/60 bg-slate-800/60 px-2 py-1.5 text-left hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50';
export function GeologicalPanel({ world, status }: { world: WorldManager; status: VolcanicStatus }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      if (e.code === 'KeyI') { e.preventDefault(); setOpen(previous => !previous); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const g = status.geology;
  const rescueDistance = Math.round(Math.hypot(g.refuge.x - status.target.x, g.refuge.z - status.target.z));
  return <section aria-label={localize("Sensores e rotas")} className="pointer-events-auto mt-2 mb-2 rounded-xl border border-slate-500/60 bg-[#172126]/95 p-3 text-slate-100">
    <button type="button" aria-expanded={open} aria-controls="geological-report" onClick={() => setOpen(!open)} className="flex w-full cursor-pointer justify-between text-left font-semibold text-teal-200"><span>{localize("Sensores, integridade e rotas · I")}</span><span>{localize(open ? '−' : '+')}</span></button>
    <p className="mt-2 text-xs">{localize(g.events.length)}{localize(" evento(s) registrado(s) · ")}{localize(g.shaking ? 'Vibração detectada' : 'Exploração / monitoramento')}</p>
    <p role="status" className="mt-1 text-xs text-amber-100">{localize(g.message)}</p>
    <div id="geological-report" hidden={!open} className="mt-3 space-y-3">
      <p className="text-[11px] text-slate-300">{localize("Futuro fictício · setor inspirado em Elysium Planitia / Cerberus Fossae. Os eventos e danos desta missão são ficcionais.")}</p>
      <div className="rounded bg-black/25 p-2">
        <h3 className="font-semibold">{localize("Sismômetro · registro instrumental")}</h3>
        <svg viewBox="0 0 260 42" aria-label={localize(g.shaking ? 'Registro de vibração no instrumento' : 'Instrumento em monitoramento, sem evento em curso')} role="img" className="mt-1 w-full text-teal-300">
          <path d={Array.from({ length: 87 }, (_, i) => `${i ? 'L' : 'M'}${i * 3},${21 + (g.shaking ? Math.sin(i * 1.8) * Math.sin(i * 0.18) * 17 * g.localIntensity : Math.sin(i * 0.9) * 0.7)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <p className="text-[10px] text-slate-400">{localize("Esquema de interface · amplitude relativa, sem escala de magnitude.")}</p>
        <ol className="mt-2 max-h-32 space-y-2 overflow-auto text-[11px]">
          {localize(g.events.length ? g.events.map(event => <li key={event.id}><strong>{localize("T+")}{localize(event.time)}{localize("s · S")}{localize(event.id)}</strong>{localize(" — ")}{localize(event.message)}</li>) : <li>{localize("Aguardando registros durante a exploração.")}</li>)}
        </ol>
      </div>
      <div><h3 className="font-semibold">{localize("Interpretação científica")}</h3><p className="mt-1 text-[11px] text-slate-300">{localize("Origem da atividade sísmica em investigação. Possível atividade magmática em profundidade; dados insuficientes para prever erupção.")}</p><p className="mt-1 text-[11px] text-slate-300">{localize("Tremores são observações. Magmatismo é uma hipótese para parte dos sinais. Nenhuma erupção atual ou iminente é confirmada aqui.")}</p></div>
      <div><h3 className="font-semibold">{localize("Integridade dos instrumentos · ")}{localize(g.equipment)}{localize("%")}</h3><p className="mt-1 text-[11px] text-slate-300">{localize(g.equipment > 55 ? 'Relé e alimentação operacionais.' : g.equipment > 30 ? 'Painel do relé danificado. Sensores em bateria; sem alimentação principal.' : 'Integridade do módulo comprometida. Operação científica indisponível.')}</p></div>
      <div><h3 className="mb-2 font-semibold">{localize("Escolha a rota · condução manual")}</h3><div className="space-y-2">{localize(g.routes.map(route => <button key={route.id} type="button" disabled={route.state !== 'open' || status.phase === 'ended' || g.evacuating} aria-pressed={g.selectedRoute === route.id} onClick={() => world.fire(GeologicalEvent.ROUTE_SELECT, route.id)} className={`${button} w-full aria-pressed:border-teal-300`}>
        <span className="block font-semibold">{localize(g.selectedRoute === route.id ? '◆ ' : '')}{localize(route.name)}{localize(" · ")}{localize(route.state === 'open' ? 'Livre' : route.state === 'falling' ? 'Queda em curso' : 'Bloqueada')}</span>
        <span className="mt-1 block text-[11px]">{localize(route.distance)}{localize(" UJ · estimativa ")}{localize(route.energyEstimate)}{localize("% de energia")}</span><span className="block text-[11px] text-slate-300">{localize(route.terrain)}{localize(". ")}{localize(route.risk)}{localize(".")}</span>
      </button>))}</div><p className="mt-1 text-[10px] text-slate-400">{localize("Estimativas do trajeto de ida; manobras, subida e tempo de uso alteram o consumo. Não representam previsão de sismos.")}</p></div>
      {localize(g.events.length >= 2 && <div><h3 className="font-semibold">{localize("Equipe no posto científico")}</h3><p className="mt-1 text-[11px]">{localize(g.rescuedCrew ? `${g.rescuedCrew} tripulantes recolhidos no Walker.` : `Relé sem energia. Dois tripulantes aguardam retirada no abrigo sinalizado no mapa (a ${rescueDistance} UJ do objetivo atual).`)}</p><button type="button" disabled={status.phase !== 'operation' || g.rescuedCrew > 0} className={`${button} mt-2`} onClick={() => world.fire(GeologicalEvent.RESCUE)}>{localize("Recolher equipe · Walker até ")}{localize(RESCUE_RANGE)}{localize(" UJ do abrigo")}</button></div>)}
      {localize(g.evacuationRequired && <div className="rounded border border-amber-400/50 p-2"><p className="text-amber-100">{localize("Retirada disponível por danos observados, energia baixa ou resgate da equipe.")}</p><button type="button" disabled={status.phase !== 'operation' || g.evacuating} onClick={() => world.fire(GeologicalEvent.EVACUATE)} className={`${button} mt-2`}>{localize(g.evacuating ? 'Siga ao ponto de retirada com a equipe embarcada' : 'Iniciar evacuação operacional')}</button></div>)}
      <details className="text-[11px] text-slate-300"><summary className="cursor-pointer">{localize("Ciência e escolhas do jogo")}</summary><p className="mt-1">{localize("O InSight detectou sismos marcianos; Cerberus Fossae é uma região de interesse sísmico. Basaltos e fraturas registram uma história vulcânica. A associação de certos sinais a magmatismo é uma interpretação em investigação.")}</p><p className="mt-1">{localize("Sequência de tremores, quedas, danos e resgate são ficção deste futuro. Não simulamos previsão de erupções.")}</p><a className="mt-1 block underline" href="https://science.nasa.gov/mission/insight/" target="_blank" rel="noreferrer">{localize("NASA · missão InSight")}</a><a className="mt-1 block underline" href="https://www.jpl.nasa.gov/news/nasas-insight-reveals-the-deep-interior-of-mars/" target="_blank" rel="noreferrer">{localize("NASA/JPL · interior de Marte")}</a></details>
    </div>
  </section>;
}
