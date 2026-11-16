import { localize, useLanguage } from "../i18n/index.ts";
import type { TerrainMeshStats } from '../systems/events/worldEvents.ts';

const original = { chunks: 144, cellsPerSide: 34 };
const uniformCellsPerSide = 20;
const originalTriangles = 2 * original.chunks * original.cellsPerSide ** 2;
const uniformTriangles = 2 * original.chunks * uniformCellsPerSide ** 2;
const number = new Intl.NumberFormat('pt-BR');
const percent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export function TerrainStatsPanel({ stats }: { stats: TerrainMeshStats }) {
  const language=useLanguage();
  const number = new Intl.NumberFormat(language==='pt'?'pt-BR':'en-US');
  const percent = new Intl.NumberFormat(language==='pt'?'pt-BR':'en-US', {style:'percent',maximumFractionDigits:1});
  const reduction = 1 - stats.triangles / originalTriangles;
  const simplifiedChunks = stats.chunks - stats.detailedChunks;

  return (
    <details className="hud-panel group pointer-events-auto ml-auto w-[22rem] min-w-0 rounded-xl text-xs text-orange-100 font-mono-tech">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 font-bold text-orange-300 hover:bg-orange-950 [&::-webkit-details-marker]:hidden">{localize("Otimização do mapa")}<span
          aria-hidden="true"
          className="transition-transform group-open:rotate-180"
        >{localize("⌃")}</span>
      </summary>
      <div className="max-h-[45dvh] overflow-y-auto overscroll-contain border-t border-orange-400/20 px-3.5 py-3">
        <table className="w-full text-left">
          <thead className="text-orange-100/70">
            <tr>
              <th scope="col" className="pb-2 font-normal">{localize("Malha")}</th>
              <th scope="col" className="pb-2 text-right font-normal">{localize("Triângulos")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="py-1 font-normal">{localize("Original: 34 x 34")}</th>
              <td className="text-right">{localize(number.format(originalTriangles))}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1 font-normal">{localize("Reduzida: 20 x 20")}</th>
              <td className="text-right">{localize(number.format(uniformTriangles))}</td>
            </tr>
            <tr className="font-bold text-orange-300 bg-orange-400/10 rounded-xs">
              <th scope="row" className="py-1 pl-1">{localize("Malha por distância")}</th>
              <td className="text-right pr-1" data-testid="terrain-triangles">
                {localize(number.format(stats.triangles))}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="bg-orange-400/20 w-[90%] h-px mt-3.25 mb-4 mx-auto" />
        <p className="font-bold text-orange-200">
          {localize(percent.format(reduction))}{localize(" menos triângulos que no original")}</p>
        <p className="mt-2 text-orange-100/85">
          {localize(stats.chunks)}{localize(" blocos no total - ")}{localize(stats.detailedChunks)}{localize(" detalhados -")}{localize(' ')}
          {localize(simplifiedChunks)}{localize(" simplificados")}</p>
      </div>
    </details>
  );
}
