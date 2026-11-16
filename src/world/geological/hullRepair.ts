// Manutenção simplificada de jogo: recuperar casco consome a reserva energética.
export const HULL_REPAIR = { hullPerSecond: 2.5, energyPerHull: 0.45, energyReserve: 10 } as const;
export interface RepairConditions { operational: boolean; hull: number; energy: number; baseMode: boolean; boarded: boolean; shaking: boolean; busy: boolean; evacuating: boolean }
export function repairBlockReason(c: RepairConditions): string | null {
  if (!c.operational) return 'O reparo exige uma operação em andamento.';
  if (c.hull <= 0) return 'O casco foi perdido; reinicie a missão.';
  if (c.hull >= 100) return 'Casco íntegro.';
  if (!c.boarded) return 'Embarque no Walker para iniciar a manutenção.';
  if (!c.baseMode) return 'Ative o Modo manutenção e mantenha o Walker parado.';
  if (c.shaking) return 'Aguarde o tremor terminar para reparar o casco.';
  if (c.busy) return 'Conclua ou interrompa a ação científica antes do reparo.';
  if (c.evacuating) return 'Conclua a retirada operacional.';
  if (c.energy < HULL_REPAIR.energyReserve + HULL_REPAIR.energyPerHull) return 'Energia insuficiente: o reparo preserva 10% de reserva.';
  return null;
}
