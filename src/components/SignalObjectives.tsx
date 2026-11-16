import { localize, useLanguage } from "../i18n/index.ts";
import { useEffect, useState } from 'react';
import type { WorldManager } from '../world/WorldManager.ts';
import { SignalEvent, type SignalAction, type SignalStatus } from '../world/signal/SignalMission.ts';
const button='mt-2 w-full rounded-md border border-[#72472e] bg-[#2c1a13] px-3 py-2 text-left hover:bg-[#3d2418] disabled:opacity-45 disabled:cursor-not-allowed';
export function SignalObjectives({world}:{world:WorldManager}){
  useLanguage();
 const [s,set]=useState<SignalStatus>(()=>world.getSignalStatus());
 useEffect(()=>{world.on(SignalEvent.STATUS,set);return()=>world.off(SignalEvent.STATUS,set);},[world]);
 const act=(a:SignalAction)=>world.fire(SignalEvent.ACTION,a);
 return <section aria-label={localize("Missão bônus")} className="pointer-events-auto mb-2 rounded-xl border border-[#72472e] bg-[#20120e] px-3 py-2 shadow-xl" onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
 <h3 className="font-semibold text-teal-200">{localize(s.completed?'✓ ':'')}{localize("Missão bônus · Restabelecer o sinal · ~2 min")}</h3>
 {localize(!s.started?<button className={button} onClick={()=>act('start')}>{localize("Iniciar missão de comunicação")}</button>:<>
 {localize(!s.completed&&<p className="mt-2">{localize("Restabeleça a energia e transmita os dados.")}</p>)}
 {localize(!s.completed&&<><ol className="mt-2"><li>{localize(s.solution?'✓':'1.')}{localize(" Restabelecer energia")}</li><li> {localize(s.completed?'✓':'2.')}{localize(" Transmitir dados")}</li></ol><p className="mt-2 text-orange-200">{localize("Ao lado da placa solar da base · ")}{localize(s.distance)}{localize(" UJ · caixa com luz vermelha.")}</p>
 <button className={button} disabled={!s.available} onClick={()=>act('open')}>{localize(s.available?'Interagir com estação · C':'Aproxime-se a pé da estação')}</button></>)}
 {localize(s.open&&!s.completed&&<div role="region" aria-label={localize("Manutenção da estação")} className="mt-2 rounded border border-orange-400/40 p-2">
 <p>{localize("Baterias de reserva: ")}<strong>{localize(s.batteries)}</strong></p><p className="mt-1 text-[#ceb2a0]">{localize("Painel solar: geração de energia. Bateria: armazenamento de energia.")}</p>
 {localize(!s.solution?<>
 <button className={button} disabled={!s.available||s.cleaning} onClick={()=>act('clean')}><strong>{localize("Limpar o painel")}</strong><br/>{localize("20 s · preserva a bateria.")}</button>
 <button className={button} disabled={!s.available||s.cleaning||s.batteries===0} onClick={()=>act('battery')}><strong>{localize("Instalar bateria")}</strong><br/>{localize("Imediato · consome 1 bateria.")}</button>
 {localize(s.batteries===0&&<p>{localize("Sem bateria de reserva disponível. Limpe o painel para gerar energia.")}</p>)}
 {localize(s.cleaning&&<><p role="status">{localize("Limpando painel · ")}{localize(Math.floor(s.elapsed))}{localize(" / 20 s")}</p><progress aria-label={localize("Limpeza do painel")} className="mt-2 w-full" max={20} value={s.elapsed}/><button className={button} onClick={()=>act('cancel')}>{localize("Cancelar limpeza")}</button></>)}
 <p className="mt-2 text-[10px]">{localize("20 s de gameplay. Afastar-se cancela.")}</p>
 </>:<><p className="mt-2 text-teal-200">{localize("Energia disponível · ")}{localize(s.solution==='clean'?'Bateria preservada':'1 bateria de reserva utilizada')}</p><button className={button} disabled={!s.available} onClick={()=>act('transmit')}>{localize("Transmitir dados")}</button></>)}
 <button className={button} onClick={()=>{act('cancel');act('close');}}>{localize("Fechar painel")}</button>
 </div>)}
 {localize(s.completed&&<p role="status" className="mt-2 text-teal-200">{localize("Comunicação restabelecida. Dados enviados.")}<br/>{localize(s.solution==='clean'?'Bateria preservada':'1 bateria de reserva utilizada')}</p>)}
 </>)}
 </section>;
}
