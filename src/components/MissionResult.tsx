import { LanguageToggle } from './LanguageToggle.tsx';
import { localize, useLanguage } from "../i18n/index.ts";
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { BASE_RESTART_DELAY, scheduleBaseRestart, shouldRestartBase } from '../systems/missionRestart.ts';
import type { VolcanicStatus } from '../systems/events/worldEvents.ts';

export function MissionResult({
  status,
  hullPercent,
  onRetry,
}: {
  status: VolcanicStatus;
  hullPercent: number;
  onRetry: () => void;
}) {
  useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [restartSeconds, setRestartSeconds] = useState(BASE_RESTART_DELAY / 1000);
  useEffect(() => {
    if (!shouldRestartBase(status)) return;
    setRestartSeconds(BASE_RESTART_DELAY / 1000);
    const countdown = setInterval(() => setRestartSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    const cancel = scheduleBaseRestart(status, onRetry);
    return () => { cancel(); clearInterval(countdown); };
  }, [status, onRetry]);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const minutes = Math.floor(status.elapsedSeconds / 60);
  const seconds = String(status.elapsedSeconds % 60).padStart(2, '0');
  const success = status.fieldActivityCompleted || status.evacuated;
  const Icon = success ? CircleCheck : CircleAlert;
  const outcome = status.evacuated ? 'Retirada concluída' : success ? 'Missão 1 concluída' : 'Operação interrompida';
  const explanation = status.evacuated
    ? `Walker retirado após perda de condições operacionais. ${status.geology.rescuedCrew} tripulantes de campo resgatados. ${status.missionCompleted ? 'M01 acondicionado e registrado.' : 'A coleta não foi concluída; a segurança da equipe teve prioridade.'}`
    : success
      ? 'O exterior avermelhado e a fratura foram registrados na mesma fotografia. O tubo M01 foi selado, acondicionado no Walker e associado aos registros da coleta.'
      : status.defeat === 'power' ? 'A energia útil se esgotou. O módulo perdeu condições operacionais.' : 'Danos estruturais zeraram a integridade do casco.';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="mission-result-title"
      onCancel={event => event.preventDefault()}
      className="hud-panel fixed inset-0 m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl p-5 text-orange-50 backdrop:bg-black/60 sm:p-6"
    >
      <LanguageToggle />
      <div className={`flex items-center gap-2.5 ${success ? 'text-teal-200' : 'text-red-200'}`}>
        <Icon aria-hidden="true" size={24} />
        <h2 id="mission-result-title" className="text-xl font-bold">{localize(outcome)}</h2>
      </div>
      <p className="mt-2 text-sm text-orange-100/80">{localize(explanation)}</p>
      <dl className="my-5 grid grid-cols-2 divide-x divide-orange-200/15 border-y border-orange-200/15 py-3 font-mono-tech">
        <div>
          <dt className="text-xs text-orange-100/75">{localize("Tempo de operação")}</dt>
          <dd className="mt-1 text-xl font-bold">{localize(minutes)}{localize(":")}{localize(seconds)}</dd>
        </div>
        <div className="pl-4">
          <dt className="text-xs text-orange-100/75">{localize("Casco restante")}</dt>
          <dd className="mt-1 text-xl font-bold">{localize(hullPercent)}{localize("%")}</dd>
        </div>
      </dl>
      {localize(shouldRestartBase(status) && <p role="status" className="mb-3 text-sm text-orange-200">{localize("Reiniciando missão em ")}{localize(restartSeconds)}{localize("s…")}</p>)}
      <button
        type="button"
        onClick={onRetry}
        className="w-full cursor-pointer rounded-lg bg-orange-400 px-3 py-2.5 text-sm font-bold text-orange-950 hover:bg-orange-300"
      >{localize("Reiniciar agora")}</button>
    </dialog>
  );
}
