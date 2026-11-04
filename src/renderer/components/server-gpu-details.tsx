import type { ServerGpuSnapshot, ServerHealthSnapshot } from "../../shared/terminal";

export function HealthUsageMeter({ value, label }: { value: number | undefined; label: string }) {
  const available = value !== undefined && Number.isFinite(value);
  return (
    <div
      className={`server-health-usage-meter${available ? "" : " is-unavailable"}`}
      role={available ? "meter" : undefined}
      aria-label={label}
      aria-valuemin={available ? 0 : undefined}
      aria-valuemax={available ? 100 : undefined}
      aria-valuenow={available ? Math.max(0, Math.min(100, value ?? 0)) : undefined}
    >
      <span style={{ width: `${available ? Math.max(0, Math.min(100, value ?? 0)) : 0}%` }} />
    </div>
  );
}

export function gpuMemoryPercent(gpu: ServerGpuSnapshot): number | undefined {
  return gpu.memoryTotalBytes && gpu.memoryUsedBytes !== undefined
    ? Math.max(0, Math.min(100, gpu.memoryUsedBytes / gpu.memoryTotalBytes * 100))
    : undefined;
}

export function ServerGpuDetails({
  snapshot,
  formatBytes,
  formatPercent
}: {
  snapshot: ServerHealthSnapshot;
  formatBytes: (bytes: number) => string;
  formatPercent: (value: number) => string;
}) {
  const gpus = snapshot.gpus ?? [];
  if (!gpus.length) {
    return (
      <div className="server-health-gpu-empty" role="status">
        <strong>{snapshot.gpuStatus === "error" ? "GPU collection failed" : "GPU metrics unavailable"}</strong>
        <p>{snapshot.gpuStatus === "error"
          ? "The GPU query failed or timed out. Other server metrics are still available."
          : "GPU monitoring currently supports NVIDIA devices, including compatible WSL sessions. The remote host must provide nvidia-smi."}</p>
      </div>
    );
  }
  return (
    <div className="server-health-gpu-grid">
      {gpus.map((gpu) => (
        <section className="server-health-gpu-device" key={gpu.id} aria-label={gpu.name}>
          <header>
            <div><span className="server-health-gpu-device__index">GPU {gpu.index}</span><h4 title={gpu.name}>{gpu.name}</h4></div>
            <span className="server-health-gpu-device__vendor">NVIDIA</span>
          </header>
          <div className="server-health-gpu-reading">
            <div><span>GPU utilization</span><strong>{gpu.utilizationPercent === undefined ? "—" : formatPercent(gpu.utilizationPercent)}</strong></div>
            <HealthUsageMeter value={gpu.utilizationPercent} label="GPU utilization" />
          </div>
          <div className="server-health-gpu-reading">
            <div><span>VRAM</span><strong>{gpu.memoryUsedBytes === undefined ? "—" : formatBytes(gpu.memoryUsedBytes)} / {gpu.memoryTotalBytes === undefined ? "—" : formatBytes(gpu.memoryTotalBytes)}</strong></div>
            <HealthUsageMeter value={gpuMemoryPercent(gpu)} label="VRAM usage" />
          </div>
          <dl className="server-health-gpu-specs">
            <div><dt>Temperature</dt><dd>{gpu.temperatureCelsius === undefined ? "—" : `${gpu.temperatureCelsius.toFixed(0)} °C`}</dd></div>
            <div><dt>Power</dt><dd>{gpu.powerDrawWatts === undefined ? "—" : `${gpu.powerDrawWatts.toFixed(1)} W`}{gpu.powerLimitWatts === undefined ? "" : ` / ${gpu.powerLimitWatts.toFixed(0)} W`}</dd></div>
            <div><dt>Driver</dt><dd>{gpu.driverVersion ?? "—"}</dd></div>
          </dl>
          <p className="server-health-gpu-device__note">Unavailable readings are shown as —, not zero.</p>
        </section>
      ))}
    </div>
  );
}
