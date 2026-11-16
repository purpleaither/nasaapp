// ASTRONAUTA — suporte de vida adaptado de oh-mars.
export const LIFE_SUPPORT_CONFIG = {
        initialHealth: 100,
        initialOxygen: 100,
        initialWater: 100,
        initialFood: 100,
        // Consumo em % por segundo: autonomia dobrada em todas as atividades.
        oxygenBaseRate: 0.4,
        oxygenWalkMultiplier: 2.0,
        oxygenRunMultiplier: 4.0,
        waterRatePerHour: 0.35,
        foodRatePerHour: 0.22,
        suffocationDamageRate: 10.0,
        dehydrationDamageRate: 2.5,
        starvationDamageRate: 1.5,
        healthRecoveryRate: 2.0,
        criticalOxygenThreshold: 25,
        safeVitalsThreshold: 20
    }
