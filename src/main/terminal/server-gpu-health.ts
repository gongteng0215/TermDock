import type { ServerGpuSnapshot, ServerHealthSnapshot } from "../../shared/terminal.js";

const query = '"$td_gpu_tool" --query-gpu=index,uuid,name,utilization.gpu,memory.total,memory.used,temperature.gpu,power.draw,power.limit,driver_version --format=csv,noheader,nounits';

// WSL exposes nvidia-smi outside PATH on some installations. A failed or
// unsupported GPU query must not discard the ordinary server-health metrics.
export const SERVER_GPU_HEALTH_COMMAND = [
  "td_gpu_tool=$(command -v nvidia-smi 2>/dev/null || true)",
  'if [ -z "$td_gpu_tool" ] && [ -x /usr/lib/wsl/lib/nvidia-smi ]; then td_gpu_tool=/usr/lib/wsl/lib/nvidia-smi; fi',
  'if [ -n "$td_gpu_tool" ]; then',
  '  if command -v timeout >/dev/null 2>&1; then',
  `    td_gpu_output=$(timeout 2s ${query} 2>/dev/null); td_gpu_result=$?;`,
  "  else",
  `    td_gpu_output=$(${query} 2>/dev/null); td_gpu_result=$?;`,
  "  fi;",
  '  if [ "$td_gpu_result" -eq 0 ]; then printf "%s\\n" "$td_gpu_output"; else echo "__TD_GPU_ERROR__"; fi;',
  'else echo "__TD_GPU_UNAVAILABLE__"; fi'
].join("\n");

function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      fields.push(value.trim());
      value = "";
    } else value += character;
  }
  fields.push(value.trim());
  return fields;
}

function optionalNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

export function parseServerGpuHealth(lines: string[]): Pick<ServerHealthSnapshot, "gpus" | "gpuStatus"> {
  if (lines.some((line) => line.trim() === "__TD_GPU_UNAVAILABLE__")) {
    return { gpus: [], gpuStatus: "unavailable" };
  }
  if (lines.some((line) => line.trim() === "__TD_GPU_ERROR__")) {
    return { gpus: [], gpuStatus: "error" };
  }
  const gpus: ServerGpuSnapshot[] = [];
  for (const line of lines) {
    const fields = parseCsvRow(line);
    const index = optionalNumber(fields[0]);
    if (fields.length < 10 || index === undefined || !Number.isInteger(index) || !fields[2]) continue;
    const utilization = optionalNumber(fields[3]);
    const totalMiB = optionalNumber(fields[4]);
    const usedMiB = optionalNumber(fields[5]);
    gpus.push({
      id: fields[1] && fields[1] !== "N/A" ? fields[1] : `nvidia:${index}`,
      index,
      name: fields[2],
      utilizationPercent: utilization === undefined ? undefined : Math.min(100, utilization),
      memoryTotalBytes: totalMiB === undefined ? undefined : totalMiB * 1024 * 1024,
      memoryUsedBytes: usedMiB === undefined ? undefined : usedMiB * 1024 * 1024,
      temperatureCelsius: optionalNumber(fields[6]),
      powerDrawWatts: optionalNumber(fields[7]),
      powerLimitWatts: optionalNumber(fields[8]),
      driverVersion: fields[9] && fields[9] !== "N/A" ? fields[9] : undefined
    });
  }
  return { gpus, gpuStatus: gpus.length ? "available" : "unavailable" };
}
