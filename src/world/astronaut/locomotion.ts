// ASTRONAUTA — movimento no sentido do corpo, com aceleração e giro limitados.
import { ASTRONAUT_CONFIG } from './config.ts';

export interface LocomotionState { heading: number; speed: number }
export interface LocomotionInput {
  forward: number;
  right: number;
  cameraYaw: number;
  running: boolean;
  dt: number;
}

export function stepLocomotion(state: LocomotionState, input: LocomotionInput) {
  const dt = Math.min(0.05, Math.max(0, input.dt));
  const yaw = input.cameraYaw * Math.PI / 180;
  const x = -Math.sin(yaw) * input.forward + Math.cos(yaw) * input.right;
  const z = -Math.cos(yaw) * input.forward - Math.sin(yaw) * input.right;
  const active = Math.hypot(x, z) > 0.001;
  let alignment = 1;
  if (active) {
    const target = Math.atan2(x, z) * 180 / Math.PI;
    const delta = ((target - state.heading + 540) % 360 + 360) % 360 - 180;
    const maxTurn = ASTRONAUT_CONFIG.turnSpeed * dt;
    const turn = Math.max(-maxTurn, Math.min(maxTurn, delta));
    state.heading = ((state.heading + turn + 180) % 360 + 360) % 360 - 180;
    // Turn toward the requested direction before taking a full stride.
    alignment = Math.max(0, Math.cos((delta - turn) * Math.PI / 180));
  }
  const maxSpeed = ASTRONAUT_CONFIG.walkSpeed * (input.running ? 1.8 : 1);
  const targetSpeed = active ? maxSpeed * alignment * alignment : 0;
  const acceleration = targetSpeed > state.speed
    ? ASTRONAUT_CONFIG.acceleration : ASTRONAUT_CONFIG.deceleration;
  state.speed += Math.max(-acceleration * dt, Math.min(acceleration * dt, targetSpeed - state.speed));
  const heading = state.heading * Math.PI / 180;
  const distance = state.speed * alignment * dt;
  return { dx: Math.sin(heading) * distance, dz: Math.cos(heading) * distance };
}
