export const HabitatEvent = {
  REGISTER: 'habitat:register', STATE: 'habitat:state', PREPARE: 'habitat:prepare',
  EXIT: 'habitat:exit', ENTER: 'habitat:enter', COMPLETE_FIELD: 'habitat:complete-field',
  PLACE_PLAYER: 'habitat:place-player', REQUEST_STATUS: 'habitat:request-status',
} as const;
export interface HabitatStatus {
  location: 'inside' | 'outside'; cycling: boolean; direction: 'exit' | 'enter';
  elapsed: number; progress: number; innerOpen: number; outerOpen: number; fade: number;
  label: 'Pressurizado' | 'Ciclo em andamento' | 'Acesso liberado';
  equipmentReady: boolean; fieldActive: boolean; canEnter: boolean; distance: number;
  message: string;
}
export interface HabitatPlacement { x: number; z: number; headingDeg: number; inside: boolean }
