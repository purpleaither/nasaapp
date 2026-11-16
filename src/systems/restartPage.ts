// Reinício completo: descarta o contexto PlayCanvas, o estado geológico e todos os eventos antigos.
const RESTART_MARKER = 'projeto-marte:restart-at-origin';

type RestartPage = {
  sessionStorage: Pick<Storage, 'setItem' | 'getItem' | 'removeItem'>;
  location: Pick<Location, 'reload'>;
};

export function restartMissionPage(page: RestartPage): void {
  // Se o navegador bloquear sessionStorage, a página ainda deve reiniciar.
  try { page.sessionStorage.setItem(RESTART_MARKER, '1'); } catch { /* volta à preparação */ }
  page.location.reload();
}

export function consumeMissionRestart(page: Pick<RestartPage, 'sessionStorage'>): boolean {
  try {
    const restart = page.sessionStorage.getItem(RESTART_MARKER) === '1';
    page.sessionStorage.removeItem(RESTART_MARKER);
    return restart;
  } catch { return false; }
}
