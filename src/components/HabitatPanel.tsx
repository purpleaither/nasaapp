import { localize, useLanguage } from "../i18n/index.ts";
import { useEffect, useState } from 'react';
import { HabitatEvent, type HabitatStatus } from '../world/habitat/events.ts';
import type { VolcanicStatus } from '../systems/events/worldEvents.ts';
import type { WorldManager } from '../world/WorldManager.ts';
import { LifeSupportEvent } from '../world/astronaut/vitals/events.ts';
import type { VitalsData } from '../world/astronaut/vitals/types.ts';
const button='cursor-pointer rounded-md border border-[#72472e] bg-[#2c1a13] px-2.5 py-1.5 font-semibold hover:bg-[#3d2418] disabled:cursor-not-allowed disabled:opacity-45';
export function HabitatPanel({world,habitat:s,status}:{world:WorldManager;habitat:HabitatStatus;status:VolcanicStatus}) {
  useLanguage();
  const [vitals,setVitals]=useState<VitalsData>(()=>world.getAstronautVitals());
  useEffect(()=>{world.on(LifeSupportEvent.VITALS_CHANGED,setVitals);return()=>world.off(LifeSupportEvent.VITALS_CHANGED,setVitals);},[world]);
  if(status.phase==='ended')return null;
  if(s.cycling)return <>
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 bg-black transition-opacity" style={{opacity:s.fade}} />
    <section role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-12 z-50 mx-auto max-w-md rounded-xl border border-[#623c27] bg-[#20120e] p-4 text-[#ffeedf] shadow-xl">
      <h2 className="font-semibold">{localize("Câmara de despressurização · ")}{localize(s.direction==='exit'?'Saída EVA':'Retorno')}</h2>
      <p className="mt-1 text-sm">{localize(s.label)}</p><p className="mt-1 text-xs text-slate-300">{localize(s.equipmentReady ? "Kit pronto para EVA." : "Prepare o kit para sair.")}</p>
      <div role="progressbar" aria-label={localize("Ciclo da câmara")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.progress*100)} className="mt-3 h-1.5 overflow-hidden rounded bg-white/15"><div className="h-full bg-teal-300" style={{width:`${s.progress*100}%`}} /></div>
      {localize(status.phase==='paused'&&<button type="button" onClick={()=>world.fire('volcanic:resume')} className={`${button} pointer-events-auto mt-2`}>{localize("Retomar ciclo pausado")}</button>)}
      <p className="mt-2 text-[11px] text-slate-400">{localize("As portas interna e externa permanecem intertravadas.")}</p>
    </section>
  </>;
  if(s.location==='outside')return s.canEnter?<aside className="pointer-events-auto fixed bottom-28 left-1/2 z-30 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-[#72472e] bg-[#20120e] p-3 text-[#ffeedf] shadow-xl">
    <p className="mb-2 text-xs">{localize("BASE HABITACIONAL · área de limpeza e acesso")}</p><button type="button" onClick={()=>world.fire(HabitatEvent.ENTER)} className={`${button} w-full`}>{localize("F · Retornar pela câmara")}</button>
  </aside>:null;
  return <section aria-label={localize("Painel da Base Habitacional")} className="pointer-events-auto mb-2 rounded-xl border border-[#623c27] bg-[#20120e] px-3 py-2 shadow-xl">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-[#fff3e6]">{localize("Base habitacional")}</h2><span className="text-xs text-teal-200">{localize(s.label)}</span></div>
    <p role="status" className="mt-2 text-xs text-[#ceb2a0]">{localize(s.equipmentReady ? "Kit pronto para EVA." : "Prepare o kit para sair.")}</p>
    <details className="mt-2 text-xs"><summary className="cursor-pointer text-orange-200">{localize("Recursos e equipamento")}</summary>
      <dl className="mt-2 grid grid-cols-2 gap-2 border-y border-[#533425] py-2">{localize([['Oxigênio do traje',vitals.oxygen],['Água',vitals.water],['Comida',vitals.food],['Vida',vitals.health],['Energia do rover',status.geology.energy],['Casco do rover',status.hull],['Instrumentos',status.geology.equipment]].map(([name,value])=><div key={String(name)}><dt className="text-[#ceb2a0]">{localize(name)}</dt><dd className="mt-0.5 font-semibold">{localize(Math.round(Number(value)))}{localize("%")}</dd></div>))}</dl>
      <p className="mt-2 text-[#ceb2a0]">{localize("Traje, câmera com proteção térmica e cabo de segurança, broca e tubo M01.")}</p>
      <p className="mt-1 text-teal-200">{localize(s.equipmentReady?'Equipamento verificado.':'Prepare o equipamento antes da saída.')}</p>
    </details>
    <div className="mt-2 grid gap-1.5">
      <button type="button" disabled={status.phase==='paused'} onClick={()=>world.fire(HabitatEvent.PREPARE)} className={button}>{localize(s.equipmentReady?'Verificar kit e repor suprimentos':'Preparar equipamento científico')}</button>
      <button type="button" disabled={!s.equipmentReady||status.phase==='paused'} onClick={()=>world.fire(HabitatEvent.EXIT)} className="cursor-pointer rounded-lg bg-[#ff9a37] px-3 py-2 font-semibold text-[#291505] hover:bg-[#ffb163] disabled:cursor-not-allowed disabled:opacity-45">{localize("Iniciar saída pela câmara · EVA")}</button>
      {localize(s.fieldActive&&<><button type="button" disabled={!status.missionCompleted||status.phase==='paused'} onClick={()=>world.fire(HabitatEvent.COMPLETE_FIELD)} className={button}>{localize("Encerrar atividade de campo")}</button>{localize(!status.missionCompleted&&<p className="text-xs text-[#ceb2a0]">{localize("Há objetivos pendentes. Você pode repor suprimentos e sair novamente.")}</p>)}</>)}
      {localize(status.phase!=='preparation'&&<button type="button" onClick={()=>world.fire(status.phase==='paused'?'volcanic:resume':'volcanic:pause')} className={button}>{localize(status.phase==='paused'?'Retomar operação':'Pausar operação')}</button>)}
    </div>
  </section>;
}
