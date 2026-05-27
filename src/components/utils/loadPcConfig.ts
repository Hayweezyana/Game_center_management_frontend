export interface PcConfig {
  pc_id: string;
  pc_name: string;
}

const PC_ID_KEY   = 'immersia_pc_id';
const PC_NAME_KEY = 'immersia_pc_name';

export function loadPcConfig(): PcConfig | null {
  try {
    const pc_id   = localStorage.getItem(PC_ID_KEY);
    const pc_name = localStorage.getItem(PC_NAME_KEY);
    if (!pc_id) return null;
    return { pc_id, pc_name: pc_name || pc_id };
  } catch {
    return null;
  }
}

export function savePcConfig(config: PcConfig): void {
  localStorage.setItem(PC_ID_KEY, config.pc_id.trim());
  localStorage.setItem(PC_NAME_KEY, config.pc_name.trim());
}

export function clearPcConfig(): void {
  localStorage.removeItem(PC_ID_KEY);
  localStorage.removeItem(PC_NAME_KEY);
}
