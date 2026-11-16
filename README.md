# Project Mars — The Red Crust

A 3D exploration game set in a fictional future on Mars. Drive a walker, investigate a rock outcrop, collect a sample, maintain your vehicle, and respond to a localized seismic crisis. The setting draws inspiration from Elysium Planitia and Cerberus Fossae. The story does not present a current or imminent Martian eruption as an established fact.

## Getting started

Requires Node.js 22.12 or newer and npm. No API key is needed to play.

```sh
npm install
npm run dev
```

Open the local URL shown by Vite. Other available commands:

```sh
npm run build    # Create a static build in dist/
npm run preview  # Preview the build locally
npm run lint     # Type-check with TypeScript
npm test         # Run the automated tests
```

## Controls

| Key | Action |
| --- | --- |
| WASD or arrow keys | Drive the walker or move on foot |
| Shift | Boost while driving or sprint on foot |
| Space | Jump on foot |
| E | Enter or leave the rover when nearby |
| F | Return through the habitat airlock while on foot near its entrance |
| C | Perform the current scientific interaction when in range |
| I | Open sensors, vehicle status, routes, and evacuation options |
| O / H / J | Refill oxygen / water / food |
| Esc | Pause |

On-screen buttons are also available for relevant actions.

## Missions and gameplay

### M01: Photograph and sample an outcrop

Start at the pressurized habitat's control panel. Review **Objectives**, **Resources**, and **Equipment**, choose **Prepare scientific equipment**, then **Start airlock EVA**. After the airlock cycle, the astronaut appears outside near the entrance. The habitat is a fixed installation; the Tortuga rover is parked beside it.

At the M01 outcrop, frame its reddish exterior and the darker exposed fracture face in **one photograph**. The EVA camera is mounted on the astronaut's chest. Photo validation checks camera position, distance, lens direction, and whether representative points on both rock regions appear in the frame. It does not use image recognition. The image must be saved successfully before sampling is unlocked.

Board the rover to operate the drill, seal the M01 tube, and record the sample. Return to the habitat, leave the rover, press **F** at the entrance, and choose **End field activity** after repressurization. You may return early to replenish supplies and leave again.

The outcrop's colors and fracture are visual features of this location. They do not identify minerals, date the fracture, or confirm active volcanism.

### Restore the signal

Choose **Start communications mission** in the objectives panel, prepare for EVA, and leave the habitat. The red-lit station is beside the solar panel west of the base. Approach it on foot and press **C** or use the interaction button. Clean it for 20 seconds, which can be canceled, or install one battery immediately. Then select **Transmit data**. This optional mission has its own completion state and preserves M01 progress.

### Vehicle maintenance and evacuation

While aboard the walker, enable **Maintenance mode** after a tremor ends, then choose **Repair hull** in the vehicle panel. Repair restores 2.5% hull integrity per second, consumes 0.45% energy per 1% restored, and reserves 10% energy. Moving, leaving maintenance mode, disembarking, or another local tremor interrupts the repair. Pausing freezes it. Repair does not restore damaged instruments or clear blocked routes.

Seismic events, rockfalls, and route obstructions are local gameplay events. The **I** panel compares a direct corridor and a detour by distance, terrain, estimated energy use, and escarpment exposure; driving remains manual. If the field shelter fails, bring the walker near its beacon and use **Rescue crew** while aboard. Vehicle damage, low energy, or a rescue can enable evacuation through the **I** panel. Reach the extraction beacon with the astronaut aboard. An evacuation without the sample does not count M01 as collected.

Health or hull integrity reaching zero restarts the mission. Depleted energy stops operation and offers a restart button. Pausing freezes simulation time, resources, and event progress.

## Language support

Use the **PT / EN** button in the upper corner to switch between Portuguese and English without restarting. The preference is saved in the browser. Menus, objectives, messages, resources, results, accessibility text, and habitat signs are translated. Translation strings are centralized in `src/i18n/en.json`.

## Science and fiction

- **Established science:** NASA's InSight mission detected marsquakes, and Cerberus Fossae is a region of seismic interest. Fractures and basalt record parts of Mars's geological history.
- **Hypothesis:** Deep magmatic processes may explain some signals. Marsquakes alone do not establish that an eruption is imminent.
- **Fictional gameplay:** The event sequence, damage, rockfalls, rescues, durations, and resource costs belong to this future setting. The sensor display is illustrative; it is neither an earthquake magnitude scale nor an eruption forecast.

References: [NASA InSight](https://science.nasa.gov/mission/insight/) and [NASA/JPL on Mars's interior](https://www.jpl.nasa.gov/news/nasas-insight-reveals-the-deep-interior-of-mars/).

## Project structure

| Path | Purpose |
| --- | --- |
| `src/components/` | HUD, mission panels, status displays, and language controls |
| `src/systems/` | Input, camera, engine, mission, time, and restart systems |
| `src/world/astronaut/` | Astronaut model, animation, movement, EVA camera, and life support |
| `src/world/habitat/` | Fixed habitat, airlock, and base interactions |
| `src/world/geological/` | Seismic events, rockfalls, shared collisions, and impact effects |
| `src/world/missions/` | M01 outcrop, photography, drill, and mission markers |
| `src/world/signal/` | Optional communications mission |
| `src/world/terrain/` | Procedural terrain, fractures, materials, and level of detail |
| `src/world/volcanic/VolcanicFront.ts` | Historical filename retained for compatibility; handles the seismic crisis and evacuation, not an active lava front |
| `public/models/` | 3D models and textures |
| `scripts/` | Model-building script and tests |
| `.openai/hosting.json` | Static hosting configuration, with `dist` as the output directory |

The astronaut model and texture were imported from `oh-mars.zip`; the first mission was adapted from `missoes-resgate-em-marte.zip`. Original references are recorded in `src/world/missions/REFERENCIAS-MISSOES.md`. Other missions from that source are not active.
