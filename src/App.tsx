import { LanguageToggle } from './components/LanguageToggle.tsx';
import { localize, useLanguage } from "./i18n/index.ts";
import { HabitatPanel } from './components/HabitatPanel.tsx';
import { HabitatEvent, type HabitatStatus } from './world/habitat/events.ts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AstronautHud } from './world/astronaut/vitals/AstronautHud.tsx';
import { HudOverlay } from './components/HudOverlay.tsx';
import { Minimap } from './components/Minimap.tsx';
import { TerrainStatsPanel } from './components/TerrainStatsPanel.tsx';
import { VolcanicProximity } from './components/VolcanicProximity.tsx';
import {
  PlayerEvent,
  type PlayerBoardingStatePayload,
  TerrainEvent,
  type TerrainMeshStats,
  VolcanicEvent,
  type VolcanicStatus,
  WalkerBaseModePayload,
  WalkerEvent,
} from './systems/events/worldEvents.ts';
import { WorldManager } from './world/WorldManager.ts';
import { restartMissionPage, consumeMissionRestart } from './systems/restartPage.ts';
import { MISSION_CONFIG } from './systems/missionConfig.ts';

export default function App() {
  useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [world, setWorld] = useState<WorldManager | null>(null);
  const handleRetry = useCallback(() => {
    restartMissionPage(window);
  }, []);
  const [boarding, setBoarding] = useState<PlayerBoardingStatePayload>({ isBoarded: true, canBoard: false, distanceToWalker: 0 });
  const [habitat, setHabitat] = useState<HabitatStatus | null>(null);
  const [baseMode, setBaseMode] = useState<boolean>(false);
  const [volcanicStatus, setVolcanicStatus] = useState<VolcanicStatus | null>(
    null,
  );
  const [terrainStats, setTerrainStats] = useState<TerrainMeshStats | null>(
    null,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resumeAfterRestart = consumeMissionRestart(window);
    // Reconstrói a partida no mesmo terreno e ponto de origem da primeira tentativa.
    const world = new WorldManager(canvas, MISSION_CONFIG.mapSeed);
    setWorld(world);
    setBaseMode(world.getWalkerBaseMode());
    setBoarding(world.getBoardingState());
    setHabitat(world.getHabitatStatus());
    setVolcanicStatus(world.getVolcanicStatus());
    setTerrainStats(world.getTerrainMeshStats());

    const onBaseModeChanged = (p: WalkerBaseModePayload) =>
      setBaseMode(p.baseMode);
    world.on(HabitatEvent.STATE, setHabitat);
    world.on(PlayerEvent.BOARDING_STATE_CHANGED, setBoarding);
    world.on(WalkerEvent.BASE_MODE_CHANGED, onBaseModeChanged);
    world.on(VolcanicEvent.STATUS_CHANGED, setVolcanicStatus);
    world.on(TerrainEvent.MESH_STATS_CHANGED, setTerrainStats);
    if (resumeAfterRestart) {
      // A nova tentativa volta à mesma base pressurizada, antes da preparação EVA.
      world.fire(HabitatEvent.REQUEST_STATUS);
    }

    return () => {
      world.off(HabitatEvent.STATE, setHabitat);
      world.off(PlayerEvent.BOARDING_STATE_CHANGED, setBoarding);
      world.off(WalkerEvent.BASE_MODE_CHANGED, onBaseModeChanged);
      world.off(VolcanicEvent.STATUS_CHANGED, setVolcanicStatus);
      world.off(TerrainEvent.MESH_STATS_CHANGED, setTerrainStats);
      world.destroy();
    };
  }, []);

  const handleToggleBaseMode = useCallback(() => {
    const next = !baseMode;
    world?.fire(WalkerEvent.SET_BASE_MODE, { baseMode: next });
  }, [baseMode, world]);

  return (
    <main
      className="relative w-screen h-screen overflow-hidden bg-[#1a0804]"
      data-state={volcanicStatus?.phase ?? 'preparation'}
      data-seed={MISSION_CONFIG.mapSeed}
      data-walker-mode={baseMode ? 'base' : 'walker'}
    >
      <LanguageToggle />
      <canvas
        id="application-canvas"
        ref={canvasRef}
        data-testid="planet-canvas"
        className="w-full h-full block"
      />
      <VolcanicProximity status={volcanicStatus} />
      {localize(world && <AstronautHud world={world} sheltered={habitat?.location === 'inside' || habitat?.cycling} isBoarded={boarding.isBoarded} status={volcanicStatus} onRetry={handleRetry} />)}
      {localize(world && habitat && volcanicStatus && (habitat.cycling || habitat.location === 'outside') && <HabitatPanel world={world} habitat={habitat} status={volcanicStatus} />)}
      <HudOverlay
        habitat={habitat}
        world={world}
        baseMode={baseMode}
        boarding={boarding}
        volcanicStatus={volcanicStatus}
        onToggleBaseMode={handleToggleBaseMode}
        onStart={() => world?.fire(VolcanicEvent.START)}
        onPause={() => world?.fire(VolcanicEvent.PAUSE)}
        onResume={() => world?.fire(VolcanicEvent.RESUME)}
        onRetry={handleRetry}
      />
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-20 flex items-end justify-between gap-2 sm:inset-x-4 sm:bottom-4">
        {localize(world && volcanicStatus && (
          <Minimap
                world={world}
            target={volcanicStatus.target}
            targetLabel={volcanicStatus.geology.evacuating ? "Retirada operacional" : volcanicStatus.returningToHabitat ? "BASE HABITACIONAL" : "Afloramento M01"}
            geology={volcanicStatus.geology}
            showTarget={(volcanicStatus.phase === 'operation' || volcanicStatus.phase === 'paused') && (!volcanicStatus.missionCompleted || volcanicStatus.returningToHabitat)}
            targetDistance={volcanicStatus.targetDistance}
          />
        ))}
        {localize(terrainStats && <TerrainStatsPanel stats={terrainStats} />)}
      </div>
    </main>
  );
}
