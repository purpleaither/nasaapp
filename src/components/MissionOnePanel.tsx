import { localize, useLanguage } from "../i18n/index.ts";
// MISSÃO 1 — objetivos, registro fotográfico e operação do tubo M01.
import { useEffect, useState } from 'react';
import { VolcanicEvent, type FieldPhoto, type FieldFeedback, type VolcanicStatus } from '../systems/events/worldEvents.ts';
import { getMission } from '../systems/missions.ts';
import type { WorldManager } from '../world/WorldManager.ts';

const stages = {
  align: 'Alinhando o braço de coleta', drill: 'Perfurando a rocha',
  recover: 'Retirando o testemunho', seal: 'Selando o tubo M01', confirmed: 'Confirmando a amostra M01',
};

export function MissionOnePanel({ world, status, atHabitat = false }: { world: WorldManager; status: VolcanicStatus; atHabitat?: boolean }) {
  useLanguage();
  const [feedback, setFeedback] = useState<FieldFeedback | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [photoSources, setPhotoSources] = useState<Record<number, 'eva' | 'walker'>>({});
  const [photos, setPhotos] = useState<Record<number, string>>({});
  useEffect(() => {
    let flashTimer: ReturnType<typeof setTimeout>;
    const onPhoto = ({ index, image, captureId, source }: FieldPhoto) => {
      const current = world.getVolcanicStatus();
      if (!current.fieldActionActive || current.fieldActionId !== captureId || current.completedCheckpoints !== index) return;
      setPhotoSources(previous => ({ ...previous, [index]: source }));
      setPhotos(previous => ({ ...previous, [index]: image }));
      setFlashing(true);
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => setFlashing(false), 160);
    };
    world.on(VolcanicEvent.FIELD_FEEDBACK, setFeedback);
    world.on(VolcanicEvent.FIELD_PROGRESS, setProgress);
    world.on(VolcanicEvent.FIELD_PHOTO, onPhoto);
    return () => {
      clearTimeout(flashTimer);
      world.off(VolcanicEvent.FIELD_FEEDBACK, setFeedback);
      world.off(VolcanicEvent.FIELD_PROGRESS, setProgress);
      world.off(VolcanicEvent.FIELD_PHOTO, onPhoto);
    };
  }, [world]);
  const mission = getMission(status.missionId);
  const checkpoint = mission.checkpoints[status.completedCheckpoints];
  const result = mission.checkpoints[status.completedCheckpoints - 1]?.result;
  const ready = !status.geology.evacuating && status.geology.equipment > 30 && !status.geology.repairActive && status.phase === 'operation' && status.targetDistance === 0 && !status.fieldRequiresBoarding && !status.fieldRequiresDisembarking;
  const bearing = Math.abs(status.targetBearing) < 8 ? 'Siga em frente' : status.targetBearing > 0 ? 'Vire à direita' : 'Vire à esquerda';
  return (
    <section aria-label={localize("Missão 1: A crosta vermelha")} className="pointer-events-auto mb-2 rounded-xl border border-[#72472e] bg-[#20120e] px-3 py-2 shadow-xl">
      <h2 className="text-sm font-semibold text-teal-200">{localize("Missão 1 · ")}{localize(mission.name)}</h2>
      {localize(feedback && <p role="status" aria-live="polite" className={`mt-2 ${feedback.kind === 'error' ? 'text-red-200' : 'text-teal-200'}`}>{localize(feedback.message)}</p>)}
      {localize(status.fieldActionActive && checkpoint?.scene === 'photo' && <div className="pointer-events-none fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 text-center">
        <div aria-hidden="true" className="mx-auto h-28 w-44 rounded border-2 border-white/80 shadow-[0_0_0_1px_#0008]" />
        <p className="mt-2 rounded bg-black/70 px-3 py-1 text-xs text-white">{localize(status.fieldOperator === 'explorer' ? 'EVA · câmera presa ao peito · enquadrando com o corpo' : 'Câmera científica do Walker')}</p>
      </div>)}
      {localize(flashing && <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 bg-white/40 motion-reduce:hidden" />)}
      {localize(status.phase === 'preparation' && <p className="mt-2 text-[#ceb2a0]">{localize("Fotografe a crosta e a fratura. Depois, colete M01 com o rover.")}</p>)}
      {localize(status.geology.evacuating && <p className="mt-2 text-amber-200">{localize("Evacuação em andamento. Embarque e leve o Walker ao ponto de retirada. A missão científica foi interrompida.")}</p>)}
      {localize(!atHabitat && checkpoint?.scene === 'photo' && <p className="mt-2 text-amber-100">{localize("Na foto: crosta vermelha e face fraturada.")}</p>)}
      {localize(status.returningToHabitat && <p className="mt-2 text-teal-100">{localize(atHabitat ? 'Coleta concluída. Encerre a atividade de campo neste painel.' : 'Volte à base. E: sair · F: entrar. Encerre no painel.')}</p>)}
      <ol className="mt-2 space-y-1 text-orange-100">
        {localize(mission.checkpoints.map((step, index) => <li key={step.scene} className={index < status.completedCheckpoints ? 'text-teal-200' : index === status.completedCheckpoints ? 'font-semibold' : 'text-[#ceb2a0]'}>
          {localize(index < status.completedCheckpoints ? '✓' : `${index + 1}.`)} {localize(step.action)}
        </li>))}
      </ol>
      {localize(status.phase !== 'preparation' && <>
        {localize(!atHabitat && <p className="mt-2 text-orange-200">{localize(status.geology.evacuating ? 'Ponto de retirada' : status.returningToHabitat ? 'BASE HABITACIONAL' : 'Afloramento')}{localize(" · ")}{localize(status.targetDistance)}{localize(" UJ · ")}{localize(bearing)}</p>)}
        {localize(status.fieldRequiresDisembarking && <p className="mt-1 text-amber-200">{localize("E: sair para fotografar.")}</p>)}
        {localize(status.fieldRequiresBoarding && <p className="mt-1 text-amber-200">{localize("E: embarcar para perfurar.")}</p>)}
        {localize(status.fieldActionActive && <div className="mt-2">
          <p role="status">{localize(status.mineralStage ? stages[status.mineralStage] : 'Registrando o afloramento…')}{localize(" · ")}{localize(Math.round(progress * 100))}{localize("%")}</p>
          <div role="progressbar" aria-label={localize("Ação científica")} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} className="mt-1 h-1.5 overflow-hidden rounded bg-white/15"><div className="h-full bg-teal-300" style={{ width: `${progress * 100}%` }} /></div>
        </div>)}
        {localize(!atHabitat && !status.geology.evacuating && checkpoint && !status.fieldActionActive && <button type="button" disabled={!ready} onClick={() => world.fire(VolcanicEvent.COMPLETE_OBJECTIVE, status.completedCheckpoints)} className="mt-2 w-full cursor-pointer rounded-md border border-[#72472e] bg-[#2c1a13] px-2.5 py-2 font-semibold hover:bg-[#3d2418] disabled:cursor-not-allowed disabled:opacity-50">
          {localize(status.fieldRequiresDisembarking ? 'Desembarque com E para fotografar' : status.fieldRequiresBoarding ? 'Embarque para perfurar' : ready ? `${checkpoint.action} · C` : 'Aproxime-se do afloramento')}
        </button>)}
        {localize(result && <p className="mt-2 text-teal-200" role="status">{localize(result)}</p>)}
        {localize(Object.keys(photos).length > 0 && <details className="mt-2"><summary className="cursor-pointer text-teal-200">{localize("Registros científicos (")}{localize(Object.keys(photos).length)}{localize(")")}</summary><div className="mt-2 grid grid-cols-2 gap-2">{localize(Object.entries(photos).map(([index, image]) => <figure key={index}><img src={image} alt={localize('Exterior avermelhado e face fraturada no mesmo enquadramento')} className="w-full rounded" /><figcaption className="mt-1 text-[10px] text-[#ceb2a0]">{localize("Exterior e fratura · ")}{localize(photoSources[Number(index)] === 'eva' ? 'EVA' : 'Walker')}</figcaption></figure>))}</div></details>)}
      </>)}
    </section>
  );
}
