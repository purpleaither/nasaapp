import { localize, useLanguage } from "../i18n/index.ts";
import { Activity, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { VolcanicStatus } from '../systems/events/worldEvents.ts';
// Nome histórico do componente; comunica observações sísmicas, sem frente vulcânica.
export function VolcanicProximity({ status }: { status: VolcanicStatus | null }) {
  useLanguage();
  if (status?.phase !== 'operation') return null;
  const g = status.geology;
  const Icon = g.shaking ? Activity : g.evacuationRequired ? TriangleAlert : ShieldCheck;
  return <aside aria-label={localize("Monitoramento geológico")} className="pointer-events-none fixed top-4 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-500/60 bg-[#172126]/95 px-3 py-2 text-slate-100 shadow-lg">
    <Icon size={18} aria-hidden="true" /><div className="text-xs"><p role="status" className="font-semibold">{localize(g.shaking ? 'Evento sísmico detectado.' : g.evacuationRequired ? 'Integridade do módulo comprometida.' : 'Monitoramento sísmico ativo')}</p><p className="mt-0.5 text-[10px] text-slate-300">{localize(g.shaking ? 'Vibração transmitida pela estrutura / traje' : 'Origem da atividade sísmica em investigação.')}</p></div>
  </aside>;
}
