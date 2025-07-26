// utils/loadPcConfig.ts
import fs from "fs";
import path from "path";

export interface PcConfig {
  pc_id: string;
  pc_title: string;
}

export function loadPcConfig(): PcConfig {
  const configPath = path.join(__dirname, "../config/pc-config.json");

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.pc_id || !parsed.pc_title) {
      throw new Error("Missing required fields in pc-config.json");
    }
    return parsed;
  } catch (err) {
    console.error("❌ Failed to load pc config:", err);
    throw err;
  }
}
